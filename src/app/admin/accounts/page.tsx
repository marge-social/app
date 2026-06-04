import Link from "next/link";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, follows, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { fediverseHandle } from "@/lib/config";

export const metadata = { title: "Comptes — Administration" };

/** §3.3.A — Liste des comptes LOCAUX de l'instance (lecture seule). */
export default async function AdminAccountsPage() {
  await requireAdmin();

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

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-black/55 dark:text-white/55">
        {accounts.length} compte{accounts.length > 1 ? "s" : ""} local
        {accounts.length > 1 ? "aux" : ""}.
      </p>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th className="px-3 py-2 font-medium">Compte</th>
              <th className="px-3 py-2 font-medium">Inscription</th>
              <th className="px-3 py-2 text-right font-medium">Billets</th>
              <th className="px-3 py-2 text-right font-medium">Abonnés</th>
              <th className="px-3 py-2 text-right font-medium">Abonnements</th>
              <th className="px-3 py-2 font-medium">Statut</th>
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
                <td className="px-3 py-2">Actif</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
