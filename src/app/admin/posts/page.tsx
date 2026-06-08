import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { effectiveSummary } from "@/lib/markdown";
import { plural } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatLongDate } from "@/lib/relative-time";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.postsMetaTitle };
}

/** §3.3.B — Billets publics (Article publiés) des comptes locaux (lecture seule). */
export default async function AdminPostsPage() {
  await requireAdmin();
  const { locale, dict } = await getServerI18n();
  const t = dict.admin;

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

  const dateFmt = (d: Date | null) => (d ? formatLongDate(d, locale) : "—");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-black/55 dark:text-white/55">
        {plural(locale, posts.length, t.postsCount)}
      </p>
      {posts.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">
          {t.postsEmpty}
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
                {t.by}{" "}
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
