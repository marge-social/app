import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, feedItems, feeds, posts, users } from "@/db/schema";
import {
  FeedDiscoveryResult,
  type FeedDiscoveryPreview,
} from "@/components/FeedDiscoveryResult";
import { Container } from "@/components/Container";
import { RemoteProfileResult } from "@/components/RemoteProfileResult";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary, htmlToText } from "@/lib/markdown";
import {
  type RemoteActorPreview,
  previewRemoteActor,
} from "@/federation/follow";
import { isBlocked } from "@/lib/blocklist";
import { previewFeed } from "@/lib/rss";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getServerI18n();
  return { title: dict.search.metaTitle };
}

const LIMIT = 25;

/** Échappe les jokers ILIKE pour traiter la requête comme du texte littéral. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Détecte un handle Fediverse (@user@instance) pour résoudre un profil (§3.3). */
function looksLikeRemoteHandle(q: string): boolean {
  return /^@?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q);
}

/** Détecte une URL http(s) pour tenter une auto-découverte de flux RSS. */
function looksLikeUrl(q: string): boolean {
  return /^https?:\/\/\S+$/i.test(q);
}

interface FeedDiscovery {
  preview: FeedDiscoveryPreview;
  blocked: boolean;
  existingId: string | null;
}

/** Résout un flux distant à partir d'une URL, best-effort (jamais d'exception). */
async function resolveFeedDiscovery(
  input: string,
): Promise<FeedDiscovery | null> {
  try {
    const preview = await previewFeed(input);
    const [blocked, existing] = await Promise.all([
      isBlocked(preview.feedUrl),
      db.query.feeds.findFirst({
        where: eq(feeds.feedUrl, preview.feedUrl),
        columns: { id: true, ownershipStatus: true },
      }),
    ]);
    return {
      preview,
      blocked: blocked || existing?.ownershipStatus === "opt_out",
      existingId:
        existing && existing.ownershipStatus !== "opt_out" ? existing.id : null,
    };
  } catch {
    return null;
  }
}

interface ContentResult {
  key: string;
  title: string;
  snippet: string;
  href: string;
  internal: boolean;
  meta: string;
  date: Date;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const pattern = likePattern(q);
  const hasQuery = q.length >= 2;
  const { dict } = await getServerI18n();
  const t = dict.search;
  const untitled = dict.feed.untitled;

  let contents: ContentResult[] = [];
  let accounts: {
    handle: string;
    displayName: string;
    bio: string;
  }[] = [];
  let fluxResults: {
    id: string;
    title: string;
    feedUrl: string;
    ownerHandle: string | null;
  }[] = [];
  // Résolutions externes lancées en parallèle des requêtes locales (best-effort) :
  // profil du Fediverse si la requête est un handle, flux RSS si c'est une URL.
  const remoteProfilePromise: Promise<RemoteActorPreview | null> =
    hasQuery && looksLikeRemoteHandle(q)
      ? previewRemoteActor(q).catch(() => null)
      : Promise.resolve(null);
  const feedDiscoveryPromise: Promise<FeedDiscovery | null> =
    hasQuery && looksLikeUrl(q)
      ? resolveFeedDiscovery(q)
      : Promise.resolve(null);

  if (hasQuery) {
    // --- Contenus : billets natifs + notes + items de flux référencés ---
    const [articleRows, postRows, itemRows] = await Promise.all([
      db
        .select({
          id: articles.id,
          title: articles.title,
          slug: articles.slug,
          summary: articles.summary,
          content: articles.contentMarkdown,
          publishedAt: articles.publishedAt,
          handle: users.handle,
          name: users.displayName,
        })
        .from(articles)
        .innerJoin(users, eq(users.id, articles.authorId))
        .where(
          and(
            eq(articles.status, "published"),
            or(
              ilike(articles.title, pattern),
              ilike(articles.contentMarkdown, pattern),
              ilike(articles.summary, pattern),
            ),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(LIMIT),
      db
        .select({
          id: posts.id,
          content: posts.contentMarkdown,
          contentHtml: posts.contentHtml,
          publishedAt: posts.publishedAt,
          handle: users.handle,
          name: users.displayName,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(ilike(posts.contentMarkdown, pattern))
        .orderBy(desc(posts.publishedAt))
        .limit(LIMIT),
      db
        .select({
          id: feedItems.id,
          title: feedItems.title,
          link: feedItems.link,
          excerpt: feedItems.excerpt,
          publishedAt: feedItems.publishedAt,
          fetchedAt: feedItems.fetchedAt,
          feedTitle: feeds.title,
          feedUrl: feeds.feedUrl,
        })
        .from(feedItems)
        .innerJoin(feeds, eq(feeds.id, feedItems.feedId))
        .where(
          and(
            ne(feeds.ownershipStatus, "opt_out"),
            or(
              ilike(feedItems.title, pattern),
              ilike(feedItems.excerpt, pattern),
            ),
          ),
        )
        .orderBy(desc(feedItems.publishedAt))
        .limit(LIMIT),
    ]);

    contents = [
      ...articleRows.map((r) => ({
        key: `a:${r.id}`,
        title: r.title || untitled,
        snippet: effectiveSummary(r.content, r.summary),
        href: `/@${r.handle}/${r.slug}`,
        internal: true,
        meta: `${t.metaArticle} · ${fediverseHandle(r.handle)}`,
        date: r.publishedAt ?? new Date(0),
      })),
      ...postRows.map((r) => {
        const text = htmlToText(r.contentHtml);
        return {
          key: `p:${r.id}`,
          title: text.slice(0, 60) || t.metaMessage,
          snippet: text.length > 280 ? `${text.slice(0, 280)}…` : text,
          href: `/@${r.handle}/notes/${r.id}`,
          internal: true,
          meta: `${t.metaMessage} · ${fediverseHandle(r.handle)}`,
          date: r.publishedAt,
        };
      }),
      ...itemRows.map((r) => ({
        key: `f:${r.id}`,
        title: r.title || untitled,
        snippet: r.excerpt,
        href: r.link,
        internal: false,
        meta: `${t.metaRssFeed} · ${r.feedTitle || r.feedUrl}`,
        date: r.publishedAt ?? r.fetchedAt,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // --- Comptes locaux ---
    accounts = await db
      .select({
        handle: users.handle,
        displayName: users.displayName,
        bio: users.bio,
      })
      .from(users)
      .where(
        or(
          ilike(users.handle, pattern),
          ilike(users.displayName, pattern),
          ilike(users.bio, pattern),
        ),
      )
      .orderBy(users.handle)
      .limit(LIMIT);

    // --- Flux référencés (hors opt-out) ---
    const feedRows = await db
      .select({
        id: feeds.id,
        title: feeds.title,
        feedUrl: feeds.feedUrl,
        ownerHandle: users.handle,
      })
      .from(feeds)
      .leftJoin(users, eq(users.id, feeds.ownerId))
      .where(
        and(
          ne(feeds.ownershipStatus, "opt_out"),
          or(
            ilike(feeds.title, pattern),
            ilike(feeds.feedUrl, pattern),
            ilike(feeds.description, pattern),
          ),
        ),
      )
      .orderBy(desc(feeds.createdAt))
      .limit(LIMIT);
    fluxResults = feedRows.map((f) => ({
      id: f.id,
      title: f.title,
      feedUrl: f.feedUrl,
      ownerHandle: f.ownerHandle,
    }));
  }

  const [remoteProfile, feedDiscovery] = await Promise.all([
    remoteProfilePromise,
    feedDiscoveryPromise,
  ]);

  const totalResults =
    contents.length +
    accounts.length +
    fluxResults.length +
    (remoteProfile ? 1 : 0) +
    (feedDiscovery ? 1 : 0);

  return (
    <Container>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <form
            action="/recherche"
            method="get"
            role="search"
            className="flex gap-2"
          >
            <label htmlFor="q" className="sr-only">
              {t.inputLabel}
            </label>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder={t.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              className="flex-1 rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
            />
            <button
              type="submit"
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              {t.submit}
            </button>
          </form>
        </header>

        {!hasQuery ? (
          <p className="text-foreground/60">{t.promptMinChars}</p>
        ) : totalResults === 0 ? (
          <p className="text-foreground/60">
            {interpolate(t.noResults, { q })}
          </p>
        ) : (
          <>
            <section
              aria-labelledby="sec-contenus"
              className="flex flex-col gap-3"
            >
              <h2 id="sec-contenus" className="text-sm font-semibold">
                {t.sectionContents} ({contents.length})
              </h2>
              {contents.length === 0 ? (
                <p className="text-sm text-foreground/55">{t.noContent}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {contents.map((c) => (
                    <li key={c.key} className="flex flex-col gap-1">
                      <div className="text-xs text-foreground/60">{c.meta}</div>
                      <h3 className="font-medium">
                        {c.internal ? (
                          <Link href={c.href} className="hover:underline">
                            {c.title}
                          </Link>
                        ) : (
                          <a
                            href={c.href}
                            className="hover:underline"
                            rel="noopener noreferrer nofollow"
                          >
                            {c.title}
                          </a>
                        )}
                      </h3>
                      {c.snippet && (
                        <p className="text-sm text-foreground/75">
                          {c.snippet}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="sec-comptes"
              className="flex flex-col gap-3"
            >
              <h2 id="sec-comptes" className="text-sm font-semibold">
                {t.sectionAccounts} ({accounts.length + (remoteProfile ? 1 : 0)}
                )
              </h2>
              {remoteProfile && <RemoteProfileResult actor={remoteProfile} />}
              {!remoteProfile && looksLikeRemoteHandle(q) && (
                <p className="text-sm text-foreground/55">
                  {interpolate(t.remoteNotFound, { q })}
                </p>
              )}
              {accounts.length === 0 && !remoteProfile ? (
                <p className="text-sm text-foreground/55">{t.noAccount}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {accounts.map((a) => (
                    <li key={a.handle} className="flex flex-col gap-0.5">
                      <Link href={`/@${a.handle}`} className="hover:underline">
                        <span className="font-medium">{a.displayName}</span>{" "}
                        <span className="font-mono text-xs text-foreground/60">
                          {fediverseHandle(a.handle)}
                        </span>
                      </Link>
                      {a.bio && (
                        <p className="text-sm text-foreground/70">{a.bio}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="sec-flux" className="flex flex-col gap-3">
              <h2 id="sec-flux" className="text-sm font-semibold">
                {t.sectionFeeds} ({fluxResults.length + (feedDiscovery ? 1 : 0)}
                )
              </h2>
              {feedDiscovery &&
                (feedDiscovery.blocked ? (
                  <p className="text-sm text-foreground/55">{t.feedOptOut}</p>
                ) : feedDiscovery.existingId ? (
                  <Link
                    href={`/feeds/${feedDiscovery.existingId}`}
                    className="rounded-lg border border-black/10 p-4 hover:bg-foreground/5 dark:border-white/15"
                  >
                    <span className="font-medium">
                      {feedDiscovery.preview.title ||
                        feedDiscovery.preview.feedUrl}
                    </span>{" "}
                    <span className="text-xs text-foreground/60">
                      {t.feedAlreadyReferenced}
                    </span>
                  </Link>
                ) : (
                  <FeedDiscoveryResult feed={feedDiscovery.preview} />
                ))}
              {!feedDiscovery && looksLikeUrl(q) && (
                <p className="text-sm text-foreground/55">
                  {t.feedNotReadable}
                </p>
              )}
              {fluxResults.length === 0 && !feedDiscovery ? (
                <p className="text-sm text-foreground/55">{t.noFeed}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {fluxResults.map((f) => (
                    <li key={f.id} className="flex flex-col gap-0.5">
                      <Link href={`/feeds/${f.id}`} className="hover:underline">
                        <span className="font-medium">
                          {f.title || f.feedUrl}
                        </span>
                      </Link>
                      <p className="text-xs text-foreground/60">
                        {f.feedUrl}
                        {f.ownerHandle
                          ? ` · ${interpolate(t.feedClaimedBy, {
                              who: fediverseHandle(f.ownerHandle),
                            })}`
                          : ` · ${t.feedOrphan}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Container>
  );
}
