import { createFederation, type Context } from "@fedify/fedify";
import {
  Accept,
  type Actor,
  Announce,
  Article,
  Create,
  Delete,
  Document,
  Endpoints,
  Follow,
  Image,
  Like,
  Note,
  Person,
  PUBLIC_COLLECTION,
  Undo,
  Update,
} from "@fedify/fedify/vocab";
import { PostgresKvStore, PostgresMessageQueue } from "@fedify/postgres";
import { Temporal } from "@js-temporal/polyfill";
import { and, count, desc, eq } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/db";
import {
  articles,
  follows,
  media,
  posts,
  remoteActors,
  remoteObjects,
  users,
} from "@/db/schema";
import { loadActorKeyPairs } from "@/federation/keys";
import {
  APP_URL,
  INSTANCE_DOMAIN,
  articleUrl,
  avatarUrl,
  noteUrl,
} from "@/lib/config";
import { effectiveSummary } from "@/lib/markdown";
import {
  type MediaView,
  loadMediaForArticles,
  loadMediaForPosts,
  mediaKindForMime,
} from "@/lib/media";
import { resolveInteractionTarget, setToggle } from "@/lib/interactions";
import type { RemoteAttachment } from "@/db/schema";
import {
  type NotificationActor,
  createFollowNotification,
  routeInteractionNotification,
} from "@/lib/notifications";

/**
 * Instance Postgres DÉDIÉE à Fedify (KV + file). On NE réutilise PAS le proxy
 * `sql` de `@/db` : une fois bundlé par Turbopack, ses traps `apply`/`get`
 * perturbent l'adaptateur `@fedify/postgres` (la sérialisation `sql.json(...)`
 * d'un message finit traitée comme un *builder* `VALUES` → l'objet est éclaté
 * en paramètres → `Token "rfc9421" invalide` / `boolean`/`Object` → file en
 * échec → Accept jamais finalisé). On passe donc l'instance brute, comme le
 * documente `@fedify/postgres`. postgres.js ne se connecte qu'à la première
 * requête (runtime) : créer l'instance au chargement du module est sans risque
 * au build (où `DATABASE_URL` est absent → URL de repli jamais contactée).
 * `onnotice` neutralise aussi le spam de NOTICE « already exists » au boot.
 */
const fedifySql = postgres(
  process.env.DATABASE_URL || "postgres://localhost:5432/marge",
  { onnotice: () => {} },
);

/**
 * Objet Federation Fedify. Cache + file de livraison sortante adossés à
 * PostgreSQL (mêmes tables que l'app). Les flux RSS NE PASSENT JAMAIS par ici :
 * seuls les comptes (acteurs) et leurs Articles fédèrent.
 */
export const kv = new PostgresKvStore(fedifySql);
export const queue = new PostgresMessageQueue(fedifySql);

// Origine canonique EXPLICITE : derrière le reverse proxy (Caddy), Fedify
// déduirait sinon son origine de la requête interne (`localhost:3000`), ce qui
// contaminerait tous les URI d'acteur (id, inbox, outbox, followers,
// publicKey.id, sharedInbox…) et ferait échouer WebFinger (mismatch d'hôte).
// `webOrigin` sert aux URL absolues ; `handleHost` à la résolution WebFinger.
export const federation = createFederation<void>({
  kv,
  queue,
  origin: { webOrigin: APP_URL, handleHost: INSTANCE_DOMAIN },
});

let storageReady: Promise<void> | null = null;

/** Crée (idempotent) les tables KV/queue de Fedify. */
export function ensureFederationStorage(): Promise<void> {
  storageReady ??= Promise.all([kv.initialize(), queue.initialize()]).then(
    () => undefined,
  );
  return storageReady;
}

type ArticleRow = typeof articles.$inferSelect;

/**
 * Convertit un média local en pièce jointe AP (`Image` pour une image, sinon
 * `Document`) avec `mediaType`, `url` et `name` = texte alternatif (repris tel
 * quel par Mastodon, §4.2). Les médias sont sur des URL publiques stables.
 */
function toAttachment(m: MediaView): Document | Image {
  const props = {
    mediaType: m.mimeType,
    url: new URL(m.url),
    name: m.alt ?? undefined,
    width: m.width ?? undefined,
    height: m.height ?? undefined,
  };
  return m.kind === "image" ? new Image(props) : new Document(props);
}

/** Construit l'objet AP `Article` dérefençable pour un article publié. */
export function buildArticleObject(
  ctx: Context<void>,
  handle: string,
  article: ArticleRow,
  attachments: MediaView[] = [],
): Article {
  const date = article.publishedAt ?? article.createdAt;
  return new Article({
    id: ctx.getObjectUri(Article, {
      identifier: handle,
      slug: article.slug,
    }),
    attribution: ctx.getActorUri(handle),
    name: article.title,
    content: article.contentHtml,
    // Dégradation gracieuse Mastodon : résumé soigné + permalien bien visible.
    summary: effectiveSummary(article.contentMarkdown, article.summary) || undefined,
    // Réponse-billet (§2.3) : `inReplyTo` pointe le contenu d'origine.
    replyTarget: article.inReplyToUri ? new URL(article.inReplyToUri) : undefined,
    attachments: attachments.map(toAttachment),
    url: new URL(articleUrl(handle, article.slug)),
    published: Temporal.Instant.from(date.toISOString()),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(handle),
  });
}

/**
 * Enveloppe un Article dans un `Create` adressé aux followers. Pour une
 * réponse-billet (§2.3), `ccActor` ajoute l'auteur du contenu d'origine aux
 * destinataires (son instance reçoit et thread la réponse).
 */
export function buildCreateForArticle(
  ctx: Context<void>,
  handle: string,
  article: ArticleRow,
  opts?: { ccActor?: string; attachments?: MediaView[] },
): Create {
  const object = buildArticleObject(ctx, handle, article, opts?.attachments);
  return new Create({
    id: new URL(`${object.id?.href}#create`),
    actor: ctx.getActorUri(handle),
    object,
    to: PUBLIC_COLLECTION,
    ccs: opts?.ccActor
      ? [ctx.getFollowersUri(handle), new URL(opts.ccActor)]
      : [ctx.getFollowersUri(handle)],
  });
}

type PostRow = typeof posts.$inferSelect;

/**
 * Construit l'objet AP `Note` déréférençable pour un message court du composer.
 * Choix retenu (§Lot 3) : les messages SANS titre sont des `Note` (microblog),
 * pas des `Article` — cohérent avec l'attendu Mastodon.
 */
export function buildNoteObject(
  ctx: Context<void>,
  handle: string,
  post: PostRow,
  attachments: MediaView[] = [],
): Note {
  const date = post.publishedAt ?? post.createdAt;
  return new Note({
    id: ctx.getObjectUri(Note, { identifier: handle, id: post.id }),
    attribution: ctx.getActorUri(handle),
    content: post.contentHtml,
    // Commentaire court (§2.2) : `inReplyTo` pointe l'objet d'origine.
    replyTarget: post.inReplyToUri ? new URL(post.inReplyToUri) : undefined,
    attachments: attachments.map(toAttachment),
    url: new URL(noteUrl(handle, post.id)),
    published: Temporal.Instant.from(date.toISOString()),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(handle),
  });
}

/**
 * Enveloppe une Note dans un `Create` adressé aux followers. Pour un
 * commentaire (§2.2), `ccActor` ajoute l'auteur du contenu d'origine aux
 * destinataires, afin que son instance reçoive et thread la réponse.
 */
export function buildCreateForNote(
  ctx: Context<void>,
  handle: string,
  post: PostRow,
  opts?: { ccActor?: string; attachments?: MediaView[] },
): Create {
  const object = buildNoteObject(ctx, handle, post, opts?.attachments);
  return new Create({
    id: new URL(`${object.id?.href}#create`),
    actor: ctx.getActorUri(handle),
    object,
    to: PUBLIC_COLLECTION,
    ccs: opts?.ccActor
      ? [ctx.getFollowersUri(handle), new URL(opts.ccActor)]
      : [ctx.getFollowersUri(handle)],
  });
}

/**
 * Construit une activité `Like` ciblant `objectIri`, adressée à l'auteur de
 * l'objet (§2.1). L'`id` est déterministe (`#likes/<objet>`) pour qu'un `Undo`
 * puisse réenvelopper exactement le même Like sans le persister.
 */
export function buildLike(
  ctx: Context<void>,
  handle: string,
  objectIri: string,
  authorActorUri: string,
): Like {
  const actor = ctx.getActorUri(handle);
  return new Like({
    id: new URL(`${actor.href}#likes/${encodeURIComponent(objectIri)}`),
    actor,
    object: new URL(objectIri),
    to: new URL(authorActorUri),
  });
}

/**
 * Construit un `Announce` (partage, §2.4) réémettant `objectIri` vers les
 * followers du partageur. `id` déterministe (`#announces/<objet>`) pour qu'un
 * `Undo` réenveloppe exactement le même Announce. Transmis tel quel, sans
 * surcouche d'amplification (§6).
 */
export function buildAnnounce(
  ctx: Context<void>,
  handle: string,
  objectIri: string,
): Announce {
  const actor = ctx.getActorUri(handle);
  return new Announce({
    id: new URL(`${actor.href}#announces/${encodeURIComponent(objectIri)}`),
    actor,
    object: new URL(objectIri),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(handle),
  });
}

// --- Acteur (Person) + clés ---------------------------------------------

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, identifier),
    });
    if (!user) return null;

    const keys = await ctx.getActorKeyPairs(identifier);
    // Avatar fédéré (§4.2) : URL publique stable du média S3 si défini, sinon
    // l'avatar legacy servi depuis Postgres (/api/avatar). null = pas d'avatar.
    let iconUrl: string | null = null;
    if (user.avatarMediaId) {
      const avatarMedia = await db.query.media.findFirst({
        where: eq(media.id, user.avatarMediaId),
        columns: { url: true },
      });
      iconUrl = avatarMedia?.url ?? null;
    } else if (user.avatarUpdatedAt) {
      iconUrl = avatarUrl(identifier);
    }
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: user.displayName,
      summary: user.bio || undefined,
      url: new URL(`${APP_URL}/@${identifier}`),
      icon: iconUrl ? new Image({ url: new URL(iconUrl) }) : undefined,
      inbox: ctx.getInboxUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      followers: ctx.getFollowersUri(identifier),
      endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
      publicKey: keys[0]?.cryptographicKey,
      assertionMethods: keys.map((k) => k.multikey),
      manuallyApprovesFollowers: false,
    });
  })
  .setKeyPairsDispatcher((_ctx, identifier) => loadActorKeyPairs(identifier));

// --- Objet Article (déréférençable) -------------------------------------

federation.setObjectDispatcher(
  Article,
  "/users/{identifier}/articles/{slug}",
  async (ctx, values) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, values.identifier),
    });
    if (!user) return null;
    const article = await db.query.articles.findFirst({
      where: and(
        eq(articles.authorId, user.id),
        eq(articles.slug, values.slug),
        eq(articles.status, "published"),
      ),
    });
    if (!article) return null;
    const attachments =
      (await loadMediaForArticles([article.id])).get(article.id) ?? [];
    return buildArticleObject(ctx, values.identifier, article, attachments);
  },
);

// --- Objet Note (déréférençable) ----------------------------------------

federation.setObjectDispatcher(
  Note,
  "/users/{identifier}/notes/{id}",
  async (ctx, values) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, values.identifier),
      columns: { id: true },
    });
    if (!user) return null;
    const post = await db.query.posts.findFirst({
      where: and(eq(posts.authorId, user.id), eq(posts.id, values.id)),
    });
    if (!post) return null;
    const attachments = (await loadMediaForPosts([post.id])).get(post.id) ?? [];
    return buildNoteObject(ctx, values.identifier, post, attachments);
  },
);

// --- Collection des followers (pour adresser "followers") ---------------

federation.setFollowersDispatcher(
  "/users/{identifier}/followers",
  async (_ctx, identifier) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, identifier),
      columns: { id: true },
    });
    if (!user) return { items: [] };

    const rows = await db
      .select({
        uri: follows.followerUri,
        inboxUrl: remoteActors.inboxUrl,
        sharedInboxUrl: remoteActors.sharedInboxUrl,
      })
      .from(follows)
      .leftJoin(remoteActors, eq(remoteActors.uri, follows.followerUri))
      .where(
        and(
          eq(follows.followingUserId, user.id),
          eq(follows.status, "accepted"),
        ),
      );

    const items = rows
      .filter((r) => r.inboxUrl)
      .map((r) => ({
        id: new URL(r.uri),
        inboxId: new URL(r.inboxUrl!),
        endpoints: r.sharedInboxUrl
          ? { sharedInbox: new URL(r.sharedInboxUrl) }
          : null,
      }));
    return { items };
  },
);

// --- Outbox (historique des publications : Articles + Notes) ------------

federation.setOutboxDispatcher(
  "/users/{identifier}/outbox",
  async (ctx, identifier) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, identifier),
      columns: { id: true },
    });
    if (!user) return { items: [] };

    const [articleRows, postRows] = await Promise.all([
      db.query.articles.findMany({
        where: and(
          eq(articles.authorId, user.id),
          eq(articles.status, "published"),
        ),
        orderBy: [desc(articles.publishedAt)],
        limit: 20,
      }),
      db.query.posts.findMany({
        where: eq(posts.authorId, user.id),
        orderBy: [desc(posts.publishedAt)],
        limit: 20,
      }),
    ]);

    // Pièces jointes des deux types, chargées en lot (pas de N+1).
    const [articleMedia, postMedia] = await Promise.all([
      loadMediaForArticles(articleRows.map((a) => a.id)),
      loadMediaForPosts(postRows.map((p) => p.id)),
    ]);

    // Fusion chronologique stricte des deux types d'objets.
    const items = [
      ...articleRows.map((a) => ({
        date: (a.publishedAt ?? a.createdAt).getTime(),
        activity: buildCreateForArticle(ctx, identifier, a, {
          attachments: articleMedia.get(a.id) ?? [],
        }),
      })),
      ...postRows.map((p) => ({
        date: (p.publishedAt ?? p.createdAt).getTime(),
        activity: buildCreateForNote(ctx, identifier, p, {
          attachments: postMedia.get(p.id) ?? [],
        }),
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 20)
      .map((e) => e.activity);

    return { items };
  },
);

// --- NodeInfo (découverte d'instance) -----------------------------------

/**
 * Document NodeInfo 2.1. Sans dispatcher, `/.well-known/nodeinfo` renvoie
 * `{"links":[]}`. On publie ici le logiciel, le protocole (ActivityPub) et des
 * statistiques honnêtes (comptes locaux + articles publiés ; aucun compteur
 * d'engagement). Le service entrant `rss2.0` reflète l'agrégation de flux.
 */
federation.setNodeInfoDispatcher("/nodeinfo/2.1", async () => {
  const [userStats] = await db.select({ value: count() }).from(users);
  const [postStats] = await db
    .select({ value: count() })
    .from(articles)
    .where(eq(articles.status, "published"));
  return {
    software: {
      name: "marge",
      version: "0.1.0",
      homepage: new URL(APP_URL),
    },
    protocols: ["activitypub"],
    services: { inbound: ["rss2.0"], outbound: [] },
    openRegistrations: true,
    usage: {
      users: { total: userStats?.value ?? 0 },
      localPosts: postStats?.value ?? 0,
      localComments: 0,
    },
  };
});

/**
 * Enregistre/MAJ un objet distant (Note/Article) reçu, pour alimenter le feed.
 * Ne stocke que ce qui est nécessaire à un aperçu honnête (extrait + lien).
 */
async function upsertRemoteObject(object: Note | Article): Promise<void> {
  if (object.id == null || object.attributionId == null) return;
  const url =
    object.url instanceof URL
      ? object.url.href
      : (object.url?.href?.toString() ?? null);
  const attachments = await extractRemoteAttachments(object);
  await db
    .insert(remoteObjects)
    .values({
      objectUri: object.id.href,
      attributedToUri: object.attributionId.href,
      type: object instanceof Article ? "Article" : "Note",
      name: object.name?.toString() ?? null,
      contentHtml: object.content?.toString() ?? null,
      summary: object.summary?.toString() ?? null,
      url,
      inReplyToUri: object.replyTargetId?.href ?? null,
      attachments: attachments.length > 0 ? attachments : null,
      publishedAt: object.published
        ? new Date(object.published.toString())
        : null,
    })
    .onConflictDoUpdate({
      target: remoteObjects.objectUri,
      set: {
        name: object.name?.toString() ?? null,
        contentHtml: object.content?.toString() ?? null,
        summary: object.summary?.toString() ?? null,
        inReplyToUri: object.replyTargetId?.href ?? null,
        attachments: attachments.length > 0 ? attachments : null,
        fetchedAt: new Date(),
      },
    });
}

/**
 * Extrait les pièces jointes d'un objet distant (§4.2) en ne gardant que les
 * `mediaType` de la liste blanche (§3.2). Best-effort : un attachment illisible
 * est ignoré, jamais re-téléchargé (URL distante conservée telle quelle).
 */
async function extractRemoteAttachments(
  object: Note | Article,
): Promise<RemoteAttachment[]> {
  const out: RemoteAttachment[] = [];
  try {
    for await (const att of object.getAttachments()) {
      if (!(att instanceof Document || att instanceof Image)) continue;
      const mediaType = att.mediaType ?? null;
      const kind = mediaKindForMime(mediaType);
      if (!kind || !mediaType) continue;
      const u = att.url;
      const href = u instanceof URL ? u.href : (u?.href?.href ?? null);
      if (!href) continue;
      out.push({
        kind,
        url: href,
        mediaType,
        name: att.name?.toString() ?? null,
        width: att.width ?? null,
        height: att.height ?? null,
      });
    }
  } catch {
    // Pièces jointes indisponibles : on garde l'objet sans média.
  }
  return out;
}

/**
 * Met en cache (upsert) la projection d'affichage d'un acteur distant et la
 * renvoie pour réutilisation immédiate (notifications). Best-effort sur
 * l'avatar : un échec de résolution ne fait jamais échouer l'inbox (§2.5).
 */
async function cacheRemoteActor(actor: Actor): Promise<NotificationActor> {
  const uri = actor.id!.href;
  const name = actor.name?.toString() ?? null;
  const username = actor.preferredUsername?.toString() ?? null;
  const handle = username ? `@${username}@${actor.id!.host}` : `@${actor.id!.host}`;
  let iconUrl: string | null = null;
  try {
    const icon = await actor.getIcon();
    const u = icon?.url;
    iconUrl = u instanceof URL ? u.href : (u?.href?.href ?? null);
  } catch {
    // Avatar indisponible : dégradation gracieuse.
  }
  await db
    .insert(remoteActors)
    .values({
      uri,
      handle,
      name,
      inboxUrl: actor.inboxId?.href ?? null,
      sharedInboxUrl: actor.endpoints?.sharedInbox?.href ?? null,
      url: actor.url instanceof URL ? actor.url.href : null,
      iconUrl,
    })
    .onConflictDoUpdate({
      target: remoteActors.uri,
      set: {
        handle,
        name,
        inboxUrl: actor.inboxId?.href ?? null,
        sharedInboxUrl: actor.endpoints?.sharedInbox?.href ?? null,
        iconUrl,
        fetchedAt: new Date(),
      },
    });
  return { uri, handle, name, iconUrl };
}

/**
 * Notifie l'auteur local d'un objet qu'un acteur distant l'a liké/partagé
 * (routé par la matrice §4.2, défaut digest §4.3). Best-effort : un échec ne
 * doit pas rompre le traitement de l'inbox.
 */
async function notifyToggleTarget(
  activity: Like | Announce,
  objectIri: string,
  type: "like" | "announce",
): Promise<void> {
  try {
    const target = await resolveInteractionTarget(objectIri);
    if (!target?.authorIsLocal || !target.authorUserId) return;
    const actor = await activity.getActor();
    if (actor?.id == null) return;
    const projection = await cacheRemoteActor(actor);
    await routeInteractionNotification({
      recipientUserId: target.authorUserId,
      type,
      origin: "federated",
      actor: projection,
      objectUri: objectIri,
    });
  } catch (err) {
    console.error("Échec de notification d'interaction entrante :", err);
  }
}

// --- Inbox : Follow / Undo, Create / Update / Delete, Accept -------------

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.objectId == null) return;
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const localHandle = parsed.identifier;

    const local = await db.query.users.findFirst({
      where: eq(users.handle, localHandle),
      columns: { id: true },
    });
    if (!local) return;

    const follower = await follow.getActor();
    if (follower?.id == null || follower.inboxId == null) return;

    // Cache + projection d'affichage de l'acteur distant (réutilisée pour la
    // notification). Best-effort sur l'avatar : un échec ne doit jamais faire
    // échouer le traitement de l'inbox (§2.5).
    const projection = await cacheRemoteActor(follower);

    // Persiste le Follow (Accept automatique au MVP).
    await db
      .insert(follows)
      .values({
        followerUri: projection.uri,
        followingUri: ctx.getActorUri(localHandle).href,
        followingUserId: local.id,
        status: "accepted",
      })
      .onConflictDoNothing();

    // Notifie le destinataire (§2.5). Best-effort : une erreur ici ne doit pas
    // empêcher l'émission de l'Accept ni rompre la fédération.
    try {
      await createFollowNotification(local.id, projection);
    } catch (err) {
      console.error("Échec de création de la notification de suivi :", err);
    }

    await ctx.sendActivity(
      { identifier: localHandle },
      follower,
      new Accept({
        actor: ctx.getActorUri(localHandle),
        object: follow,
      }),
    );
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject();

    // Undo(Like) ou Undo(Announce) entrant → on désactive la bascule (§2.1/§2.4).
    if (object instanceof Like || object instanceof Announce) {
      const objectId = object.objectId;
      const actorId = object.actorId ?? undo.actorId;
      if (objectId == null || actorId == null) return;
      await setToggle({
        type: object instanceof Like ? "Like" : "Announce",
        actorIri: actorId.href,
        objectIri: objectId.href,
        origin: "federated",
        active: false,
      });
      return;
    }

    if (!(object instanceof Follow) || object.objectId == null) return;
    const parsed = ctx.parseUri(object.objectId);
    if (parsed?.type !== "actor") return;
    const followerUri = undo.actorId?.href;
    if (!followerUri) return;
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerUri, followerUri),
          eq(follows.followingUri, ctx.getActorUri(parsed.identifier).href),
        ),
      );
  })
  // Like entrant ciblant un de nos objets locaux → journalisé (compteur public)
  // + notification routée par la matrice de l'auteur (défaut like=digest, §4.3).
  .on(Like, async (_ctx, like) => {
    const objectId = like.objectId;
    const actorId = like.actorId;
    if (objectId == null || actorId == null) return;
    if (!objectId.href.startsWith(`${APP_URL}/users/`)) return;
    await setToggle({
      type: "Like",
      actorIri: actorId.href,
      objectIri: objectId.href,
      origin: "federated",
      activityIri: like.id?.href ?? null,
      active: true,
    });
    await notifyToggleTarget(like, objectId.href, "like");
  })
  // Announce entrant (un acteur suivi partage un objet, §2.4) → journalisé +
  // ingestion de l'objet partagé pour le réémettre dans le fil des abonnés +
  // notification de l'auteur si l'objet est local (matrice, défaut digest §4.3).
  .on(Announce, async (_ctx, announce) => {
    const objectId = announce.objectId;
    const actorId = announce.actorId;
    if (objectId == null || actorId == null) return;
    await setToggle({
      type: "Announce",
      actorIri: actorId.href,
      objectIri: objectId.href,
      origin: "federated",
      activityIri: announce.id?.href ?? null,
      active: true,
    });
    // L'objet partagé est distant : on le déréférence pour pouvoir l'afficher.
    if (!objectId.href.startsWith(`${APP_URL}/users/`)) {
      try {
        const obj = await announce.getObject();
        if (obj instanceof Note || obj instanceof Article) {
          await upsertRemoteObject(obj);
        }
      } catch {
        // Objet indisponible : on garde tout de même la trace de l'Announce.
      }
    } else {
      await notifyToggleTarget(announce, objectId.href, "announce");
    }
  })
  // Contenu distant entrant → alimente le feed (extrait + lien).
  .on(Create, async (_ctx, create) => {
    const object = await create.getObject();
    if (!(object instanceof Note || object instanceof Article)) return;
    await upsertRemoteObject(object);

    // Réponse entrante ciblant un de NOS objets locaux → notification (§4.1).
    // Une Note→« commentaire », un Article→« réponse ». Le défaut est temps
    // réel pour les deux (§4.3) : on notifie immédiatement.
    const parentUri = object.replyTargetId?.href;
    if (!parentUri) return;
    const target = await resolveInteractionTarget(parentUri);
    if (!target?.authorIsLocal || !target.authorUserId) return;

    const actor = await create.getActor();
    if (actor?.id == null) return;
    const projection = await cacheRemoteActor(actor);
    try {
      await routeInteractionNotification({
        recipientUserId: target.authorUserId,
        type: object instanceof Article ? "reply" : "comment",
        origin: "federated",
        actor: projection,
        objectUri: parentUri,
      });
    } catch (err) {
      console.error("Échec de création de la notification de réponse :", err);
    }
  })
  .on(Update, async (_ctx, update) => {
    const object = await update.getObject();
    if (object instanceof Note || object instanceof Article) {
      await upsertRemoteObject(object);
    }
  })
  .on(Delete, async (_ctx, del) => {
    const objectId = del.objectId;
    if (objectId == null) return;
    await db
      .delete(remoteObjects)
      .where(eq(remoteObjects.objectUri, objectId.href));
  })
  // Accept de NOTRE Follow sortant → on marque la relation acceptée.
  // Robuste : certains serveurs renvoient l'`object` du Follow sous forme d'IRI
  // (et notre id de Follow est une URI à fragment `…#follows/…` non
  // déréférençable → un re-fetch tombe sur le `Person`, pas le `Follow`). Dans
  // ce cas on retombe sur le match (following = acteur qui accepte, pending).
  .on(Accept, async (_ctx, accept) => {
    const remoteUri = accept.actorId?.href; // l'acteur distant qui accepte
    if (!remoteUri) {
      console.warn("[inbox/Accept] sans actorId — ignoré");
      return;
    }

    let localFollowerUri: string | null = null;
    try {
      const object = await accept.getObject();
      if (object instanceof Follow) {
        localFollowerUri = object.actorId?.href ?? null;
      } else {
        console.warn(
          `[inbox/Accept] objet non-Follow (${object?.constructor?.name ?? "null"}) — fallback`,
        );
      }
    } catch (err) {
      console.error("[inbox/Accept] getObject a échoué — fallback :", err);
    }

    const updated = await db
      .update(follows)
      .set({ status: "accepted" })
      .where(
        localFollowerUri
          ? and(
              eq(follows.followerUri, localFollowerUri),
              eq(follows.followingUri, remoteUri),
            )
          : and(
              eq(follows.followingUri, remoteUri),
              eq(follows.status, "pending"),
            ),
      )
      .returning({ id: follows.id });

    console.log(
      `[inbox/Accept] de ${remoteUri} (follower=${localFollowerUri ?? "?"}) → ${updated.length} ligne(s) acceptée(s)`,
    );
  });
