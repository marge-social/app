import { createFederation, type Context } from "@fedify/fedify";
import {
  Accept,
  Article,
  Create,
  Delete,
  Endpoints,
  Follow,
  Note,
  Person,
  PUBLIC_COLLECTION,
  Undo,
  Update,
} from "@fedify/fedify/vocab";
import { PostgresKvStore, PostgresMessageQueue } from "@fedify/postgres";
import { Temporal } from "@js-temporal/polyfill";
import { and, count, desc, eq } from "drizzle-orm";
import { db, sql } from "@/db";
import {
  articles,
  follows,
  remoteActors,
  remoteObjects,
  users,
} from "@/db/schema";
import { loadActorKeyPairs } from "@/federation/keys";
import { APP_URL, INSTANCE_DOMAIN, articleUrl } from "@/lib/config";
import { effectiveSummary } from "@/lib/markdown";

/**
 * Objet Federation Fedify. Cache + file de livraison sortante adossés à
 * PostgreSQL (mêmes tables que l'app, via `sql`). Les flux RSS NE PASSENT
 * JAMAIS par ici : seuls les comptes (acteurs) et leurs Articles fédèrent.
 */
export const kv = new PostgresKvStore(sql);
export const queue = new PostgresMessageQueue(sql);

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

/** Construit l'objet AP `Article` dérefençable pour un article publié. */
export function buildArticleObject(
  ctx: Context<void>,
  handle: string,
  article: ArticleRow,
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
    url: new URL(articleUrl(handle, article.slug)),
    published: Temporal.Instant.from(date.toISOString()),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(handle),
  });
}

/** Enveloppe un Article dans un `Create` adressé aux followers. */
export function buildCreateForArticle(
  ctx: Context<void>,
  handle: string,
  article: ArticleRow,
): Create {
  const object = buildArticleObject(ctx, handle, article);
  return new Create({
    id: new URL(`${object.id?.href}#create`),
    actor: ctx.getActorUri(handle),
    object,
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
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: user.displayName,
      summary: user.bio || undefined,
      url: new URL(`${APP_URL}/@${identifier}`),
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
    return buildArticleObject(ctx, values.identifier, article);
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

// --- Outbox (historique des Articles publiés) ---------------------------

federation.setOutboxDispatcher(
  "/users/{identifier}/outbox",
  async (ctx, identifier) => {
    const user = await db.query.users.findFirst({
      where: eq(users.handle, identifier),
      columns: { id: true },
    });
    if (!user) return { items: [] };
    const rows = await db.query.articles.findMany({
      where: and(
        eq(articles.authorId, user.id),
        eq(articles.status, "published"),
      ),
      orderBy: [desc(articles.publishedAt)],
      limit: 20,
    });
    return {
      items: rows.map((a) => buildCreateForArticle(ctx, identifier, a)),
    };
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
        fetchedAt: new Date(),
      },
    });
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

    // Cache de l'acteur distant.
    await db
      .insert(remoteActors)
      .values({
        uri: follower.id.href,
        name: follower.name?.toString() ?? null,
        inboxUrl: follower.inboxId.href,
        sharedInboxUrl: follower.endpoints?.sharedInbox?.href ?? null,
        url: follower.url instanceof URL ? follower.url.href : null,
      })
      .onConflictDoUpdate({
        target: remoteActors.uri,
        set: {
          inboxUrl: follower.inboxId.href,
          sharedInboxUrl: follower.endpoints?.sharedInbox?.href ?? null,
          fetchedAt: new Date(),
        },
      });

    // Persiste le Follow (Accept automatique au MVP).
    await db
      .insert(follows)
      .values({
        followerUri: follower.id.href,
        followingUri: ctx.getActorUri(localHandle).href,
        followingUserId: local.id,
        status: "accepted",
      })
      .onConflictDoNothing();

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
  // Contenu distant entrant → alimente le feed (extrait + lien).
  .on(Create, async (_ctx, create) => {
    const object = await create.getObject();
    if (object instanceof Note || object instanceof Article) {
      await upsertRemoteObject(object);
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
  .on(Accept, async (_ctx, accept) => {
    const object = await accept.getObject();
    if (!(object instanceof Follow)) return;
    const localFollowerUri = object.actorId?.href; // notre acteur
    const remoteUri = accept.actorId?.href; // l'acteur distant suivi
    if (!localFollowerUri || !remoteUri) return;
    await db
      .update(follows)
      .set({ status: "accepted" })
      .where(
        and(
          eq(follows.followerUri, localFollowerUri),
          eq(follows.followingUri, remoteUri),
        ),
      );
  });
