import Link from "next/link";
import type { FeedEntry } from "@/lib/feed";
import { getServerI18n } from "@/lib/i18n/server";
import { FeedComposer } from "@/components/discover/FeedComposer";
import { FeedEntryCard } from "@/components/discover/FeedEntryCard";
import { LeftRail, type MeSummary } from "@/components/discover/LeftRail";
import { AlgoNote } from "@/components/discover/AlgoNote";

/**
 * Shell « Découvrir » — grille 3 colonnes du fil de l'utilisateur connecté,
 * branché sur les **vraies** données (`buildFeed`). Server component : seules
 * les sous-parties réellement interactives sont des îles client (composer,
 * note algorithmique). Le fil est chronologique strict, sans classement ni
 * compteur d'engagement servant au tri (§6).
 */
export async function DiscoverShell({
  me,
  entries,
  hasMore,
  nextHref,
}: {
  me: MeSummary;
  entries: FeedEntry[];
  hasMore: boolean;
  nextHref: string;
}) {
  const { locale, dict } = await getServerI18n();
  const t = dict.feed;

  return (
    <div className="grid-shell" data-density="comfy">
      <LeftRail me={me} />

      <div className="feed">
        <FeedComposer />

        {entries.length === 0 ? (
          <p className="text-ink-3" style={{ padding: "16px 0", fontSize: 15 }}>
            {dict.home.emptyBefore}{" "}
            <Link href="/recherche" className="underline">
              {dict.home.emptyLink}
            </Link>{" "}
            {dict.home.emptyAfter}
          </p>
        ) : (
          <>
            {entries.map((e) => (
              <FeedEntryCard key={e.key} e={e} dict={t} locale={locale} />
            ))}
            {hasMore && (
              <Link
                href={nextHref}
                scroll={false}
                className="composer-action"
                style={{ alignSelf: "center", marginTop: 24 }}
              >
                {dict.home.loadMore}
              </Link>
            )}
          </>
        )}
      </div>

      <aside className="rail" aria-label="À propos du classement">
        <AlgoNote />
      </aside>
    </div>
  );
}
