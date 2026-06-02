import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { articles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";

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

        {!isSelf && (
          // Deux gestes de suivi distincts, jamais couplés (cf. §2).
          // Inertes au S0 : la mécanique fédérée arrive en S2/S3.
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              disabled
              title="Disponible au sprint S2/S3"
              className="rounded border border-black/20 px-3 py-1 text-sm opacity-50 dark:border-white/25"
            >
              Suivre le compte
            </button>
          </div>
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
                {a.summary && (
                  <p className="text-sm text-foreground/80">{a.summary}</p>
                )}
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
