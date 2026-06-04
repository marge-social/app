import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  articles,
  feedItems,
  feeds,
  posts,
  users,
} from "@/db/schema";
import { RemoteFollowForm } from "@/components/RemoteFollowForm";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary, htmlToText } from "@/lib/markdown";

export const metadata: Metadata = { title: "Recherche — Marge" };

const LIMIT = 25;

/** Échappe les jokers ILIKE pour traiter la requête comme du texte littéral. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Détecte un handle Fediverse (@user@instance) pour proposer un suivi (§3.3). */
function looksLikeRemoteHandle(q: string): boolean {
  return /^@?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q);
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
        title: r.title || "(sans titre)",
        snippet: effectiveSummary(r.content, r.summary),
        href: `/@${r.handle}/${r.slug}`,
        internal: true,
        meta: `Billet · ${fediverseHandle(r.handle)}`,
        date: r.publishedAt ?? new Date(0),
      })),
      ...postRows.map((r) => {
        const text = htmlToText(r.contentHtml);
        return {
          key: `p:${r.id}`,
          title: text.slice(0, 60) || "Message",
          snippet: text.length > 280 ? `${text.slice(0, 280)}…` : text,
          href: `/@${r.handle}/notes/${r.id}`,
          internal: true,
          meta: `Message · ${fediverseHandle(r.handle)}`,
          date: r.publishedAt,
        };
      }),
      ...itemRows.map((r) => ({
        key: `f:${r.id}`,
        title: r.title || "(sans titre)",
        snippet: r.excerpt,
        href: r.link,
        internal: false,
        meta: `Flux RSS · ${r.feedTitle || r.feedUrl}`,
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

  const totalResults =
    contents.length + accounts.length + fluxResults.length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Recherche</h1>
        <form action="/recherche" method="get" role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Rechercher des contenus, comptes ou flux
          </label>
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Mots-clés, @compte@instance, titre de flux…"
            autoCapitalize="none"
            autoCorrect="off"
            className="flex-1 rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
          />
          <button
            type="submit"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Rechercher
          </button>
        </form>
      </header>

      {hasQuery && looksLikeRemoteHandle(q) && (
        <section className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <h2 className="text-sm font-semibold">
            Suivre un compte du Fediverse
          </h2>
          <p className="text-sm text-foreground/70">
            « {q} » ressemble à un handle Fediverse. Vous pouvez le suivre :
          </p>
          <RemoteFollowForm />
        </section>
      )}

      {!hasQuery ? (
        <p className="text-foreground/60">
          Saisissez au moins deux caractères pour rechercher des contenus, des
          comptes et des flux sur l’instance.
        </p>
      ) : totalResults === 0 ? (
        <p className="text-foreground/60">
          Aucun résultat pour « {q} ».
        </p>
      ) : (
        <>
          <section aria-labelledby="sec-contenus" className="flex flex-col gap-3">
            <h2 id="sec-contenus" className="text-sm font-semibold">
              Contenus ({contents.length})
            </h2>
            {contents.length === 0 ? (
              <p className="text-sm text-foreground/55">Aucun contenu.</p>
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
                      <p className="text-sm text-foreground/75">{c.snippet}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="sec-comptes" className="flex flex-col gap-3">
            <h2 id="sec-comptes" className="text-sm font-semibold">
              Comptes ({accounts.length})
            </h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-foreground/55">Aucun compte.</p>
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
              Flux ({fluxResults.length})
            </h2>
            {fluxResults.length === 0 ? (
              <p className="text-sm text-foreground/55">Aucun flux.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {fluxResults.map((f) => (
                  <li key={f.id} className="flex flex-col gap-0.5">
                    <Link href={`/feeds/${f.id}`} className="hover:underline">
                      <span className="font-medium">{f.title || f.feedUrl}</span>
                    </Link>
                    <p className="text-xs text-foreground/60">
                      {f.feedUrl}
                      {f.ownerHandle
                        ? ` · réclamé par ${fediverseHandle(f.ownerHandle)}`
                        : " · orphelin"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
