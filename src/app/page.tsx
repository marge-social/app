import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { buildFeed } from "@/lib/feed";
import { Composer } from "@/components/Composer";
import { FeedList } from "@/components/FeedList";
import { getServerI18n } from "@/lib/i18n/server";

const PAGE_SIZE = 20;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const user = await getCurrentUser();
  const { dict } = await getServerI18n();

  // Visiteur non connecté : page de présentation.
  if (!user) {
    const h = dict.home;
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">{h.landingTitle}</h1>
        <p className="text-lg text-foreground/80">{h.landingP1}</p>
        <p className="text-lg text-foreground/80">{h.landingP2}</p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
          >
            {dict.nav.signup}
          </Link>
          <Link
            href="/login"
            className="rounded border border-black/20 px-4 py-2 font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            {dict.nav.login}
          </Link>
        </div>
      </div>
    );
  }

  // Utilisateur connecté : fil unifié + composer.
  const { n } = await searchParams;
  const pages = Math.max(1, Math.min(20, Number.parseInt(n ?? "1", 10) || 1));
  const limit = pages * PAGE_SIZE;
  const { entries, hasMore } = await buildFeed(user, { limit });
  const h = dict.home;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{h.feedTitle}</h1>
        <p className="text-sm text-foreground/70">
          <span className="font-mono">{fediverseHandle(user.handle)}</span> —{" "}
          {h.feedSubtitle}
        </p>
      </header>

      <Composer />

      <section className="flex flex-col gap-6" aria-label={h.feedTitle}>
        {entries.length === 0 ? (
          <p className="text-foreground/60">
            {h.emptyBefore}{" "}
            <Link href="/recherche" className="underline">
              {h.emptyLink}
            </Link>{" "}
            {h.emptyAfter}
          </p>
        ) : (
          <>
            <FeedList entries={entries} />
            {hasMore && (
              <Link
                href={`/?n=${pages + 1}`}
                scroll={false}
                className="self-center rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {h.loadMore}
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
