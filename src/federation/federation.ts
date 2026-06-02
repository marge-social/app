import { createFederation, type Context } from "@fedify/fedify";
import {
  Accept,
  Article,
  Create,
  Endpoints,
  Follow,
  Person,
  PUBLIC_COLLECTION,
  Undo,
} from "@fedify/fedify/vocab";
import { PostgresKvStore, PostgresMessageQueue } from "@fedify/postgres";
import { Temporal } from "@js-temporal/polyfill";
import { and, desc, eq } from "drizzle-orm";
import { db, sql } from "@/db";
import {
  articles,
  follows,
  remoteActors,
  users,
} from "@/db/schema";
import { loadActorKeyPairs } from "@/federation/keys";
import { APP_URL, articleUrl } from "@/lib/config";
import { effectiveSummary } from "@/lib/markdown";

/**
 * Objet Federation Fedify. Cache + file de livraison sortante adossés à
 * PostgreSQL (mêmes tables que l'app, via `sql`). Les flux RSS NE PASSENT
 * JAMAIS par ici : seuls les comptes (acteurs) et leurs Articles fédèrent.
 */
export const kv = new PostgresKvStore(sql);
export const queue = new PostgresMessageQueue(sql);

export const federation = createFederation<void>({ kv, queue });

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

// --- Inbox : Follow / Undo(Follow) (minimum pour être suivable) ----------

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
  });
