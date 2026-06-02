import Link from "next/link";
import { desc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { feedSubscriptions, feeds } from "@/db/schema";
import { ReferenceFeedForm } from "@/components/ReferenceFeedForm";
import { getCurrentUser } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  orphan: "orphelin",
  claimed: "réclamé",
  opt_out: "retiré",
};

export default async function FeedsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Flux référencés (hors opt-out), du plus récent au plus ancien.
  const rows = await db.query.feeds.findMany({
    where: ne(feeds.ownershipStatus, "opt_out"),
    orderBy: [desc(feeds.createdAt)],
  });

  const myFeedIds = rows.length
    ? new Set(
        (
          await db
            .select({ feedId: feedSubscriptions.feedId })
            .from(feedSubscriptions)
            .where(eq(feedSubscriptions.userId, user.id))
        ).map((r) => r.feedId),
      )
    : new Set<string>();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Flux</h1>
        <p className="text-sm text-foreground/70">
          Référence un blog externe (RSS) et suis-le. Les flux ne fédèrent jamais
          — ils restent internes à Marge.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Référencer un flux</h2>
        <ReferenceFeedForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">
          Flux référencés ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-foreground/60">
            Aucun flux pour l’instant. Référence le premier ci-dessus.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((f) => (
              <li key={f.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/feeds/${f.id}`}
                    className="font-medium hover:underline"
                  >
                    {f.title || f.feedUrl}
                  </Link>
                  <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs text-foreground/60 dark:bg-white/10">
                    {STATUS_LABEL[f.ownershipStatus]}
                  </span>
                  {myFeedIds.has(f.id) && (
                    <span className="text-xs text-green-700 dark:text-green-400">
                      suivi
                    </span>
                  )}
                  {f.techStatus === "error" && (
                    <span className="text-xs text-red-700 dark:text-red-300">
                      en erreur
                    </span>
                  )}
                </div>
                {f.description && (
                  <p className="text-sm text-foreground/70">{f.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
