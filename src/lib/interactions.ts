import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, interactions, posts, remoteObjects, users } from "@/db/schema";
import { APP_URL, actorUri } from "@/lib/config";

/** Format UUID (garde avant toute requête `eq(posts.id, …)` pour éviter une
 *  erreur Postgres « invalid input syntax for type uuid » sur entrée hostile). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InteractionTarget {
  objectIri: string;
  /** IRI de l'acteur auteur de l'objet (destinataire en fédéré). */
  authorActorUri: string;
  authorIsLocal: boolean;
  /** Renseignés quand l'auteur est un compte local (pour notifier en base). */
  authorUserId?: string;
  authorHandle?: string;
}

/**
 * Valide qu'`objectIri` désigne un objet réellement interactif connu de marge —
 * billet local publié, note locale, ou objet distant déjà ingéré — et renvoie
 * l'auteur (à notifier / à qui fédérer). Empêche d'agir sur un IRI arbitraire.
 * `null` si inconnu. Partagé par like et commentaire.
 */
export async function resolveInteractionTarget(
  objectIri: string,
): Promise<InteractionTarget | null> {
  const prefix = `${APP_URL}/users/`;
  if (objectIri.startsWith(prefix)) {
    const segs = objectIri.slice(prefix.length).split("/");
    if (segs.length !== 3) return null;
    const [handle, kind, id] = segs;
    const user = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: { id: true },
    });
    if (!user) return null;
    if (kind === "articles") {
      const a = await db.query.articles.findFirst({
        where: and(
          eq(articles.authorId, user.id),
          eq(articles.slug, id),
          eq(articles.status, "published"),
        ),
        columns: { id: true },
      });
      if (!a) return null;
    } else if (kind === "notes") {
      if (!UUID_RE.test(id)) return null;
      const p = await db.query.posts.findFirst({
        where: and(eq(posts.authorId, user.id), eq(posts.id, id)),
        columns: { id: true },
      });
      if (!p) return null;
    } else {
      return null;
    }
    return {
      objectIri,
      authorActorUri: actorUri(handle),
      authorIsLocal: true,
      authorUserId: user.id,
      authorHandle: handle,
    };
  }

  // Objet distant : likeable seulement s'il a été ingéré (présent dans le fil).
  const remote = await db.query.remoteObjects.findFirst({
    where: eq(remoteObjects.objectUri, objectIri),
    columns: { attributedToUri: true },
  });
  if (!remote) return null;
  return {
    objectIri,
    authorActorUri: remote.attributedToUri,
    authorIsLocal: false,
  };
}

/** Interactions réversibles journalisées dans `interactions` (§2.1 / §2.4). */
export type ToggleType = "Like" | "Announce";

/**
 * Bascule l'état d'une interaction réversible (Like §2.1 / Announce §2.4) de
 * `actorIri` sur `objectIri`. Idempotent : un second appel actif ne crée pas de
 * doublon, une annulation renseigne `undoneAt` sans supprimer la ligne (ré-actif
 * → réactivation). Traite local et fédéré de façon homogène (seul `origin`
 * change). L'index unique partiel (type, acteur, objet) garantit l'unicité.
 */
export async function setToggle(params: {
  type: ToggleType;
  actorIri: string;
  objectIri: string;
  origin: "local" | "federated";
  activityIri?: string | null;
  active: boolean;
}): Promise<void> {
  const existing = await db.query.interactions.findFirst({
    where: and(
      eq(interactions.type, params.type),
      eq(interactions.actorIri, params.actorIri),
      eq(interactions.objectIri, params.objectIri),
    ),
  });

  if (params.active) {
    if (!existing) {
      await db
        .insert(interactions)
        .values({
          type: params.type,
          actorIri: params.actorIri,
          objectIri: params.objectIri,
          origin: params.origin,
          activityIri: params.activityIri ?? null,
        })
        .onConflictDoNothing();
    } else if (existing.undoneAt) {
      // Réactivation d'une interaction précédemment annulée.
      await db
        .update(interactions)
        .set({
          undoneAt: null,
          createdAt: new Date(),
          activityIri: params.activityIri ?? existing.activityIri,
        })
        .where(eq(interactions.id, existing.id));
    }
  } else if (existing && !existing.undoneAt) {
    await db
      .update(interactions)
      .set({ undoneAt: new Date() })
      .where(eq(interactions.id, existing.id));
  }
}

export interface ToggleStat {
  count: number;
  activeForViewer: boolean;
}

/**
 * Compte des interactions actives d'un type (toutes origines — décision §8
 * option c : compteur public, jamais utilisé pour trier, cf. §6) pour un lot
 * d'objets, et si le spectateur l'a posée. Une requête agrégée + une requête
 * « moi » : pas de N+1 sur le fil.
 */
export async function getToggleStatsFor(
  type: ToggleType,
  objectIris: string[],
  viewerActorIri: string | null,
): Promise<Map<string, ToggleStat>> {
  const map = new Map<string, ToggleStat>();
  if (objectIris.length === 0) return map;

  const rows = await db
    .select({ objectIri: interactions.objectIri, total: count() })
    .from(interactions)
    .where(
      and(
        eq(interactions.type, type),
        isNull(interactions.undoneAt),
        inArray(interactions.objectIri, objectIris),
      ),
    )
    .groupBy(interactions.objectIri);
  for (const r of rows) {
    map.set(r.objectIri, { count: Number(r.total), activeForViewer: false });
  }

  if (viewerActorIri) {
    const mine = await db
      .select({ objectIri: interactions.objectIri })
      .from(interactions)
      .where(
        and(
          eq(interactions.type, type),
          isNull(interactions.undoneAt),
          eq(interactions.actorIri, viewerActorIri),
          inArray(interactions.objectIri, objectIris),
        ),
      );
    for (const r of mine) {
      const e = map.get(r.objectIri) ?? { count: 0, activeForViewer: false };
      e.activeForViewer = true;
      map.set(r.objectIri, e);
    }
  }

  return map;
}
