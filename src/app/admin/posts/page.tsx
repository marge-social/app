import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { effectiveSummary } from "@/lib/markdown";

export const metadata = { title: "Billets — Administration" };

/** §3.3.B — Billets publics (Article publiés) des comptes locaux (lecture seule). */
export default async function AdminPostsPage() {
  await requireAdmin();

  const posts = await db.query.articles.findMany({
    where: eq(articles.status, "published"),
    orderBy: [desc(articles.publishedAt)],
    columns: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      contentMarkdown: true,
      publishedAt: true,
    },
    with: {
      author: { columns: { handle: true, displayName: true } },
    },
    limit: 200,
  });

  const dateFmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-black/55 dark:text-white/55">
        {posts.length} billet{posts.length > 1 ? "s" : ""} public
        {posts.length > 1 ? "s" : ""}.
      </p>
      {posts.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">
          Aucun billet public publié sur l’instance pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={`/@${p.author.handle}/${p.slug}`}
                  className="font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <span className="text-xs whitespace-nowrap text-black/55 dark:text-white/55">
                  {dateFmt(p.publishedAt)}
                </span>
              </div>
              <p className="text-xs text-black/55 dark:text-white/55">
                par{" "}
                <Link
                  href={`/@${p.author.handle}`}
                  className="hover:underline"
                >
                  @{p.author.handle}
                </Link>
              </p>
              <p className="line-clamp-2 text-sm text-black/70 dark:text-white/70">
                {effectiveSummary(p.contentMarkdown, p.summary)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
