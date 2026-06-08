import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { digestItems, interactions, notifications } from "@/db/schema";

export interface DigestResult {
  /** Items en file traités (digérés). */
  items: number;
  /** Notifications groupées créées. */
  notifications: number;
  /** Destinataires concernés. */
  recipients: number;
}

/**
 * Moteur de digest (§4.3/§4.4) : regroupe les signaux pauvres accumulés en file
 * (`digest_items`) en notifications « N personnes ont … », puis marque les
 * items digérés. Un récap, jamais un teaser (§6) : aucune relance, aucun
 * compteur cumulatif. Idempotent — déjà-digérés ignorés. Déclenché par cron à
 * la cadence souhaitée (quotidien par défaut).
 *
 * Pour les bascules (like/announce), seuls les items dont l'interaction est
 * **encore active** sont comptés : un like annulé avant le digest ne gonfle pas
 * le total. Les commentaires/réponses sont toujours comptés (objets distincts).
 */
export async function runDigest(): Promise<DigestResult> {
  const pending = await db
    .select()
    .from(digestItems)
    .where(isNull(digestItems.digestedAt));
  if (pending.length === 0) {
    return { items: 0, notifications: 0, recipients: 0 };
  }

  // Interactions encore actives pour filtrer les bascules annulées.
  const objectUris = [
    ...new Set(pending.map((p) => p.objectUri).filter((u): u is string => !!u)),
  ];
  const activeSet = new Set<string>();
  if (objectUris.length > 0) {
    const rows = await db
      .select({
        type: interactions.type,
        actorIri: interactions.actorIri,
        objectIri: interactions.objectIri,
      })
      .from(interactions)
      .where(
        and(
          isNull(interactions.undoneAt),
          inArray(interactions.objectIri, objectUris),
        ),
      );
    for (const r of rows) {
      activeSet.add(`${r.type}|${r.actorIri}|${r.objectIri}`);
    }
  }

  type Item = (typeof pending)[number];
  const isLive = (it: Item): boolean => {
    if (it.type === "like") {
      return activeSet.has(`Like|${it.actorUri}|${it.objectUri}`);
    }
    if (it.type === "announce") {
      return activeSet.has(`Announce|${it.actorUri}|${it.objectUri}`);
    }
    return true; // comment / reply : objets distincts, toujours comptés.
  };

  // Regroupement par (destinataire, type, objet).
  const groups = new Map<string, Item[]>();
  for (const it of pending) {
    const key = `${it.recipientUserId}|${it.type}|${it.objectUri ?? ""}`;
    const arr = groups.get(key);
    if (arr) arr.push(it);
    else groups.set(key, [it]);
  }

  const recipients = new Set<string>();
  let created = 0;
  const processedIds: string[] = [];

  for (const items of groups.values()) {
    for (const it of items) processedIds.push(it.id);

    const live = items.filter(isLive);
    // Acteurs distincts (un même acteur ne compte qu'une fois).
    const byActor = new Map<string, Item>();
    for (const it of live) if (!byActor.has(it.actorUri)) byActor.set(it.actorUri, it);
    const distinct = [...byActor.values()];
    if (distinct.length === 0) continue; // tout annulé → rien à notifier.

    // Représentant = item le plus récent (affichage de l'acteur en tête).
    const rep = distinct.reduce((a, b) =>
      b.createdAt.getTime() > a.createdAt.getTime() ? b : a,
    );

    recipients.add(rep.recipientUserId);
    await db.insert(notifications).values({
      recipientUserId: rep.recipientUserId,
      type: rep.type,
      actorUri: rep.actorUri,
      actorHandle: rep.actorHandle,
      actorName: rep.actorName,
      actorIconUrl: rep.actorIconUrl,
      objectUri: rep.objectUri,
      groupCount: distinct.length,
    });
    created += 1;
  }

  // Marque tous les items traités comme digérés (même ceux annulés : consommés).
  if (processedIds.length > 0) {
    await db
      .update(digestItems)
      .set({ digestedAt: new Date() })
      .where(inArray(digestItems.id, processedIds));
  }

  return {
    items: processedIds.length,
    notifications: created,
    recipients: recipients.size,
  };
}
