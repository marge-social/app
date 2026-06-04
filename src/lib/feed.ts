import "server-only";
import { and, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  actorBlocks,
  articles,
  feedItems,
  feedSubscriptions,
  feeds,
  follows,
  posts,
  remoteActors,
  remoteObjects,
  users,
} from "@/db/schema";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary, htmlToText, readingTimeMinutes } from "@/lib/markdown";

export type FeedEntryKind = "note" | "article" | "remote" | "rss";

export interface FeedEntry {
  key: string;
  kind: FeedEntryKind;
  title: string | null;
  authorLabel: string;
  /** Handle local de l'auteur (pour l'avatar) ; absent pour distant/RSS. */
  authorHandle?: string;
  date: Date;
  /** Aperçu honnête (article/distant/RSS). */
  summary: string;
  /** Corps complet sanitisé (notes natives, affichées en entier). */
  contentHtml?: string;
  href: string;
  /** Lien interne (Next <Link>) vs externe (<a>). */
  internal: boolean;
  source: "compte Marge" | "Fediverse" | "flux RSS";
  readingMinutes?: number;
}

const PREVIEW_LEN = 280;

/**
 * Construit le fil unifié d'un utilisateur (§Lot 3) : fusion chronologique
 * stricte des billets/notes des comptes Marge suivis **et de soi-même**, des
 * objets distants des comptes Fediverse suivis, et des items des flux RSS
 * suivis. Aucun classement algorithmique, aucun compteur d'engagement.
 *
 * Pagination par taille cumulative : on récupère `limit + 1` entrées pour
 * savoir s'il en reste (`hasMore`), puis on tronque à `limit`.
 */
export async function buildFeed(
  viewer: { id: string; handle: string; displayName: string },
  opts: { limit: number },
): Promise<{ entries: FeedEntry[]; hasMore: boolean }> {
  const fetchLimit = opts.limit + 1;

  // Comptes Marge suivis + soi-même (pour voir ses propres publications).
  const localFollows = await db
    .select({ id: users.id, handle: users.handle, name: users.displayName })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingUserId))
    .where(
      and(
        eq(follows.followerUserId, viewer.id),
        isNotNull(follows.followingUserId),
        eq(follows.status, "accepted"),
      ),
    );

  const localAccounts = new Map<string, { handle: string; name: string }>();
  localAccounts.set(viewer.id, {
    handle: viewer.handle,
    name: viewer.displayName,
  });
  for (const f of localFollows) {
    localAccounts.set(f.id, { handle: f.handle, name: f.name });
  }
  const localIds = [...localAccounts.keys()];

  // Comptes distants suivis.
  const remoteFollows = await db
    .select({
      uri: follows.followingUri,
      name: remoteActors.name,
      handle: remoteActors.handle,
    })
    .from(follows)
    .leftJoin(remoteActors, eq(remoteActors.uri, follows.followingUri))
    .where(
      and(
        eq(follows.followerUserId, viewer.id),
        isNull(follows.followingUserId),
      ),
    );

  const blockedRows = await db
    .select({ actorUri: actorBlocks.actorUri })
    .from(actorBlocks)
    .where(eq(actorBlocks.userId, viewer.id));
  const blockedUris = new Set(blockedRows.map((b) => b.actorUri));

  const entries: FeedEntry[] = [];

  // Billets (Articles publiés) des comptes locaux.
  if (localIds.length > 0) {
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        summary: articles.summary,
        content: articles.contentMarkdown,
        publishedAt: articles.publishedAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(
        and(
          inArray(articles.authorId, localIds),
          eq(articles.status, "published"),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(fetchLimit);
    for (const r of rows) {
      const a = localAccounts.get(r.authorId)!;
      entries.push({
        key: `a:${r.id}`,
        kind: "article",
        title: r.title,
        authorLabel: `${a.name} · ${fediverseHandle(a.handle)}`,
        authorHandle: a.handle,
        date: r.publishedAt ?? new Date(0),
        summary: effectiveSummary(r.content, r.summary),
        href: `/@${a.handle}/${r.slug}`,
        internal: true,
        source: "compte Marge",
        readingMinutes: readingTimeMinutes(r.content),
      });
    }

    // Messages courts (Notes) des comptes locaux — affichés en entier.
    const postRows = await db
      .select({
        id: posts.id,
        contentHtml: posts.contentHtml,
        publishedAt: posts.publishedAt,
        authorId: posts.authorId,
      })
      .from(posts)
      .where(inArray(posts.authorId, localIds))
      .orderBy(desc(posts.publishedAt))
      .limit(fetchLimit);
    for (const r of postRows) {
      const a = localAccounts.get(r.authorId)!;
      entries.push({
        key: `p:${r.id}`,
        kind: "note",
        title: null,
        authorLabel: `${a.name} · ${fediverseHandle(a.handle)}`,
        authorHandle: a.handle,
        date: r.publishedAt,
        summary: "",
        contentHtml: r.contentHtml,
        href: `/@${a.handle}/notes/${r.id}`,
        internal: true,
        source: "compte Marge",
      });
    }
  }

  // Contenus distants des comptes Fediverse suivis.
  const remoteUris = remoteFollows
    .map((f) => f.uri)
    .filter((uri) => !blockedUris.has(uri));
  if (remoteUris.length > 0) {
    const rows = await db
      .select()
      .from(remoteObjects)
      .where(inArray(remoteObjects.attributedToUri, remoteUris))
      .orderBy(desc(remoteObjects.publishedAt))
      .limit(fetchLimit);
    const labelByUri = new Map(
      remoteFollows.map((f) => [f.uri, f.handle ?? f.name ?? f.uri]),
    );
    for (const r of rows) {
      const text = r.contentHtml ? htmlToText(r.contentHtml) : "";
      entries.push({
        key: `r:${r.id}`,
        kind: "remote",
        title: r.name,
        authorLabel: labelByUri.get(r.attributedToUri) ?? r.attributedToUri,
        date: r.publishedAt ?? r.fetchedAt,
        summary:
          r.summary ??
          (text.length > PREVIEW_LEN ? `${text.slice(0, PREVIEW_LEN)}…` : text),
        href: r.url ?? r.objectUri,
        internal: false,
        source: "Fediverse",
      });
    }
  }

  // Items des flux RSS suivis (FeedSubscription, indépendant du follow compte).
  const subRows = await db
    .select({
      feedId: feedSubscriptions.feedId,
      feedTitle: feeds.title,
      feedUrl: feeds.feedUrl,
    })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feeds.id, feedSubscriptions.feedId))
    .where(eq(feedSubscriptions.userId, viewer.id));
  if (subRows.length > 0) {
    const feedLabel = new Map(
      subRows.map((s) => [s.feedId, s.feedTitle || s.feedUrl]),
    );
    const rows = await db
      .select()
      .from(feedItems)
      .where(
        inArray(
          feedItems.feedId,
          subRows.map((s) => s.feedId),
        ),
      )
      .orderBy(desc(feedItems.publishedAt))
      .limit(fetchLimit);
    for (const r of rows) {
      entries.push({
        key: `f:${r.id}`,
        kind: "rss",
        title: r.title,
        authorLabel: r.author
          ? `${r.author} · ${feedLabel.get(r.feedId)}`
          : (feedLabel.get(r.feedId) ?? ""),
        date: r.publishedAt ?? r.fetchedAt,
        summary: r.excerpt,
        href: r.link,
        internal: false,
        source: "flux RSS",
      });
    }
  }

  // Tri chronologique strict (du plus récent au plus ancien).
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasMore = entries.length > opts.limit;
  return { entries: entries.slice(0, opts.limit), hasMore };
}
