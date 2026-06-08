import Link from "next/link";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, follows, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { fediverseHandle } from "@/lib/config";
import { plural } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatLongDate } from "@/lib/relative-time";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.accountsMetaTitle };
}

/** §3.3.A — Liste des comptes LOCAUX de l'instance (lecture seule). */
export default async function AdminAccountsPage() {
  await requireAdmin();
  const { locale, dict } = await getServerI18n();
  const t = dict.admin;

  const accounts = await db.query.users.findMany({
    columns: {
      id: true,
      handle: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
    orderBy: [desc(users.createdAt)],
  });

  // Agrégats (une requête groupée par métrique plutôt qu'une requête par compte).
  const publishedCounts = await db
    .select({ authorId: articles.authorId, n: count() })
    .from(articles)
    .where(eq(articles.status, "published"))
    .groupBy(articles.authorId);

  const followerCounts = await db
    .select({ uid: follows.followingUserId, n: count() })
    .from(follows)
    .where(
      and(eq(follows.status, "accepted"), isNotNull(follows.followingUserId)),
    )
    .groupBy(follows.followingUserId);

  const followingCounts = await db
    .select({ uid: follows.followerUserId, n: count() })
    .from(follows)
    .where(
      and(eq(follows.status, "accepted"), isNotNull(follows.followerUserId)),
    )
    .groupBy(follows.followerUserId);

  const published = new Map(publishedCounts.map((r) => [r.authorId, r.n]));
  const followers = new Map(followerCounts.map((r) => [r.uid, r.n]));
  const following = new Map(followingCounts.map((r) => [r.uid, r.n]));

  const dateFmt = (d: Date) => formatLongDate(d, locale);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-black/55 dark:text-white/55">
        {plural(locale, accounts.length, t.accountsCount)}
      </p>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th className="px-3 py-2 font-medium">{t.colAccount}</th>
              <th className="px-3 py-2 font-medium">{t.colSignup}</th>
              <th className="px-3 py-2 text-right font-medium">{t.colPosts}</th>
              <th className="px-3 py-2 text-right font-medium">
                {t.colFollowers}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                {t.colFollowing}
              </th>
              <th className="px-3 py-2 font-medium">{t.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                className="border-b border-black/5 last:border-0 dark:border-white/10"
              >
                <td className="px-3 py-2">
                  <Link href={`/@${a.handle}`} className="hover:underline">
                    <span className="font-medium">{a.displayName}</span>
                  </Link>
                  <div className="text-xs text-black/55 dark:text-white/55">
                    {fediverseHandle(a.handle)}
                    {a.role === "admin" && (
                      <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5">
                        admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {dateFmt(a.createdAt)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {published.get(a.id) ?? 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {followers.get(a.id) ?? 0}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {following.get(a.id) ?? 0}
                </td>
                <td className="px-3 py-2">{t.statusActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
