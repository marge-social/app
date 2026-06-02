import Link from "next/link";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles, follows, remoteActors, remoteObjects, users } from "@/db/schema";
import {
  unfollowLocalAction,
  unfollowRemoteAction,
} from "@/app/actions/follows";
import { RemoteFollowForm } from "@/components/RemoteFollowForm";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary, htmlToText } from "@/lib/markdown";

interface FeedEntry {
  key: string;
  title: string | null;
  authorLabel: string;
  date: Date;
  summary: string;
  href: string;
  internal: boolean;
  source: "compte Marge" | "Fediverse";
}

export default async function FeedPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  // --- Comptes locaux suivis ---
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

  // --- Comptes distants suivis ---
  const remoteFollows = await db
    .select({
      uri: follows.followingUri,
      status: follows.status,
      name: remoteActors.name,
      handle: remoteActors.handle,
      url: remoteActors.url,
    })
    .from(follows)
    .leftJoin(remoteActors, eq(remoteActors.uri, follows.followingUri))
    .where(
      and(eq(follows.followerUserId, viewer.id), isNull(follows.followingUserId)),
    );

  const entries: FeedEntry[] = [];

  // Articles des comptes Marge suivis.
  const localIds = localFollows.map((f) => f.id);
  if (localIds.length > 0) {
    const rows = await db
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
        and(inArray(articles.authorId, localIds), eq(articles.status, "published")),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(100);
    for (const r of rows) {
      entries.push({
        key: `a:${r.id}`,
        title: r.title,
        authorLabel: `${r.name} · ${fediverseHandle(r.handle)}`,
        date: r.publishedAt ?? new Date(0),
        summary: effectiveSummary(r.content, r.summary),
        href: `/@${r.handle}/${r.slug}`,
        internal: true,
        source: "compte Marge",
      });
    }
  }

  // Contenus distants des comptes Fediverse suivis.
  const remoteUris = remoteFollows.map((f) => f.uri);
  if (remoteUris.length > 0) {
    const rows = await db
      .select()
      .from(remoteObjects)
      .where(inArray(remoteObjects.attributedToUri, remoteUris))
      .orderBy(desc(remoteObjects.publishedAt))
      .limit(100);
    const labelByUri = new Map(
      remoteFollows.map((f) => [f.uri, f.handle ?? f.name ?? f.uri]),
    );
    for (const r of rows) {
      const text = r.contentHtml ? htmlToText(r.contentHtml) : "";
      entries.push({
        key: `r:${r.id}`,
        title: r.name,
        authorLabel: labelByUri.get(r.attributedToUri) ?? r.attributedToUri,
        date: r.publishedAt ?? r.fetchedAt,
        summary: r.summary ?? (text.length > 280 ? `${text.slice(0, 280)}…` : text),
        href: r.url ?? r.objectUri,
        internal: false,
        source: "Fediverse",
      });
    }
  }

  // Tri chronologique strict (du plus récent au plus ancien).
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  const followingCount = localFollows.length + remoteFollows.length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Mon fil</h1>
        <p className="text-sm text-foreground/70">
          <span className="font-mono">{fediverseHandle(viewer.handle)}</span> —
          fil chronologique des comptes que tu suis.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Suivre un compte du Fediverse</h2>
        <RemoteFollowForm />
      </section>

      {followingCount > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Comptes suivis ({followingCount})</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {localFollows.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Link href={`/@${f.handle}`} className="hover:underline">
                  {f.name}{" "}
                  <span className="font-mono text-foreground/60">
                    {fediverseHandle(f.handle)}
                  </span>
                </Link>
                <form action={unfollowLocalAction}>
                  <input type="hidden" name="targetUserId" value={f.id} />
                  <button className="text-xs text-foreground/50 underline">
                    ne plus suivre
                  </button>
                </form>
              </li>
            ))}
            {remoteFollows.map((f) => (
              <li key={f.uri} className="flex items-center gap-2">
                <a
                  href={f.url ?? f.uri}
                  className="font-mono hover:underline"
                  rel="noopener noreferrer nofollow"
                >
                  {f.handle ?? f.name ?? f.uri}
                </a>
                {f.status === "pending" && (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    (en attente)
                  </span>
                )}
                <form action={unfollowRemoteAction}>
                  <input type="hidden" name="remoteUri" value={f.uri} />
                  <button className="text-xs text-foreground/50 underline">
                    ne plus suivre
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold">Fil</h2>
        {entries.length === 0 ? (
          <p className="text-foreground/60">
            Ton fil est vide. Suis des comptes Marge (depuis leur profil) ou des
            comptes du Fediverse ci-dessus pour le remplir.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {entries.map((e) => (
              <li
                key={e.key}
                className="flex flex-col gap-1 border-b border-black/5 pb-5 dark:border-white/10"
              >
                <div className="flex items-center gap-2 text-xs text-foreground/60">
                  <span>{e.authorLabel}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={e.date.toISOString()}>
                    {e.date.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                  <span aria-hidden>·</span>
                  <span>{e.source}</span>
                </div>
                <h3 className="text-lg font-semibold">
                  {e.internal ? (
                    <Link href={e.href} className="hover:underline">
                      {e.title || "(sans titre)"}
                    </Link>
                  ) : (
                    <a
                      href={e.href}
                      className="hover:underline"
                      rel="noopener noreferrer nofollow"
                    >
                      {e.title || "(sans titre)"}
                    </a>
                  )}
                </h3>
                {e.summary && (
                  <p className="text-sm text-foreground/80">{e.summary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
