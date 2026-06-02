import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { articles, follows, users } from "@/db/schema";
import {
  followLocalAction,
  unfollowLocalAction,
} from "@/app/actions/follows";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary } from "@/lib/markdown";

interface ProfileParams {
  params: Promise<{ handle: string }>;
}

/**
 * Profil public d'un compte : /@handle.
 * Le segment d'URL doit commencer par « @ » (style Fediverse).
 */
export default async function ProfilePage({ params }: ProfileParams) {
  // Next.js fournit le segment encodé (« %40claire ») : on décode avant test.
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const handle = decoded.slice(1).toLowerCase();

  const profile = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;

  const isFollowing = viewer
    ? !!(await db.query.follows.findFirst({
        where: and(
          eq(follows.followerUserId, viewer.id),
          eq(follows.followingUserId, profile.id),
        ),
        columns: { id: true },
      }))
    : false;

  const published = await db.query.articles.findMany({
    where: and(
      eq(articles.authorId, profile.id),
      eq(articles.status, "published"),
    ),
    orderBy: [desc(articles.publishedAt)],
    columns: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      contentMarkdown: true,
      publishedAt: true,
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {profile.displayName}
        </h1>
        <p className="font-mono text-sm text-foreground/70">
          {fediverseHandle(profile.handle)}
        </p>
        {profile.bio && <p className="text-foreground/90">{profile.bio}</p>}

        {!isSelf && viewer && (
          // Suivi du COMPTE (fédéré). Distinct et jamais couplé au suivi des
          // flux RSS de l'auteur (cf. §2).
          <div className="mt-2 flex gap-3">
            <form
              action={isFollowing ? unfollowLocalAction : followLocalAction}
            >
              <input type="hidden" name="targetUserId" value={profile.id} />
              <button
                type="submit"
                className={
                  isFollowing
                    ? "rounded border border-black/20 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                    : "rounded bg-foreground px-3 py-1 text-sm font-medium text-background hover:opacity-90"
                }
              >
                {isFollowing ? "Ne plus suivre le compte" : "Suivre le compte"}
              </button>
            </form>
          </div>
        )}
        {!isSelf && !viewer && (
          <p className="mt-2 text-sm text-foreground/60">
            <Link href="/login" className="underline">
              Connecte-toi
            </Link>{" "}
            pour suivre ce compte.
          </p>
        )}
      </header>

      <section aria-labelledby="articles-heading" className="flex flex-col gap-4">
        <h2 id="articles-heading" className="text-lg font-semibold">
          Textes publiés
        </h2>
        {published.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Aucun texte publié pour l’instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {published.map((a) => (
              <li key={a.id} className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">
                  <Link
                    href={`/@${profile.handle}/${a.slug}`}
                    className="hover:underline"
                  >
                    {a.title}
                  </Link>
                </h3>
                {a.publishedAt && (
                  <time
                    dateTime={a.publishedAt.toISOString()}
                    className="text-xs text-foreground/60"
                  >
                    {a.publishedAt.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                )}
                <p className="text-sm text-foreground/80">
                  {effectiveSummary(a.contentMarkdown, a.summary)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="feeds-heading" className="flex flex-col gap-3">
        <h2 id="feeds-heading" className="text-lg font-semibold">
          Flux RSS déclarés
        </h2>
        <p className="text-sm text-foreground/60">
          Aucun flux déclaré pour l’instant.
        </p>
      </section>
    </div>
  );
}
