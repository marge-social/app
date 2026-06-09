import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { feedItems, feedSubscriptions, feeds, users } from "@/db/schema";
import {
  subscribeFeedAction,
  unsubscribeFeedAction,
} from "@/app/actions/feeds";
import { toggleFullTextAction } from "@/app/actions/claims";
import { ClaimPanel } from "@/components/ClaimPanel";
import { Container } from "@/components/Container";
import { getCurrentUser } from "@/lib/auth";
import { getServerI18n } from "@/lib/i18n/server";
import { isYouTubeFeedUrl } from "@/lib/youtube";
import { formatLongDate } from "@/lib/relative-time";

interface FeedParams {
  params: Promise<{ id: string }>;
}

export default async function FeedDetailPage({ params }: FeedParams) {
  const { id } = await params;
  const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, id) });
  if (!feed || feed.ownershipStatus === "opt_out") notFound();

  // Un flux YouTube n'est pas le blog de l'utilisateur : non revendiquable → on
  // ne propose ni réclamation ni opt-out (cf. src/lib/youtube.ts).
  const claimable = !isYouTubeFeedUrl(feed.feedUrl);

  const viewer = await getCurrentUser();
  const { locale, dict } = await getServerI18n();
  const t = dict.feedDetail;
  const statusLabel: Record<string, string> = {
    orphan: t.statusOrphan,
    claimed: t.statusClaimed,
    opt_out: t.statusOptOut,
  };
  const owner = feed.ownerId
    ? await db.query.users.findFirst({
        where: eq(users.id, feed.ownerId),
        columns: { handle: true, displayName: true },
      })
    : null;

  const subscribed = viewer
    ? !!(await db.query.feedSubscriptions.findFirst({
        where: and(
          eq(feedSubscriptions.userId, viewer.id),
          eq(feedSubscriptions.feedId, feed.id),
        ),
        columns: { id: true },
      }))
    : false;

  const items = await db.query.feedItems.findMany({
    where: eq(feedItems.feedId, feed.id),
    orderBy: [desc(feedItems.publishedAt)],
    limit: 50,
  });

  return (
    <Container>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {feed.title || feed.feedUrl}
          </h1>
          <p className="text-sm text-foreground/70">
            <a
              href={feed.feedUrl}
              className="underline"
              rel="noopener noreferrer nofollow"
            >
              {feed.feedUrl}
            </a>
          </p>
          <p className="text-xs text-foreground/60">
            {t.statusPrefix} {statusLabel[feed.ownershipStatus]}
            {owner && (
              <>
                {" "}
                · {t.ownedBy}{" "}
                <Link href={`/@${owner.handle}`} className="underline">
                  {owner.displayName}
                </Link>
              </>
            )}
          </p>
          {feed.description && (
            <p className="text-foreground/80">{feed.description}</p>
          )}

          {viewer ? (
            <form
              action={subscribed ? unsubscribeFeedAction : subscribeFeedAction}
              className="mt-1"
            >
              <input type="hidden" name="feedId" value={feed.id} />
              <button
                type="submit"
                className={
                  subscribed
                    ? "rounded border border-black/20 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                    : "rounded bg-foreground px-3 py-1 text-sm font-medium text-background hover:opacity-90"
                }
              >
                {subscribed
                  ? dict.profile.unfollowFeed
                  : dict.profile.followFeed}
              </button>
            </form>
          ) : (
            <p className="text-sm text-foreground/60">
              <Link href="/" className="underline">
                {dict.profile.loginToFollowLink}
              </Link>{" "}
              {t.loginToFollowSuffix}
            </p>
          )}
        </header>

        {/* Page vers laquelle pointe le User-Agent du crawler : réclamation /
          opt-out (preuve de contrôle par jeton) et contrôles propriétaire. */}
        {viewer && feed.ownerId === viewer.id ? (
          <section className="flex flex-col gap-3 rounded border border-black/15 p-4 dark:border-white/20">
            <h3 className="font-semibold">{t.ownerTitle}</h3>
            <form
              action={toggleFullTextAction}
              className="flex items-center gap-3"
            >
              <input type="hidden" name="feedId" value={feed.id} />
              <button
                type="submit"
                className="rounded border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
              >
                {feed.fullTextAllowed ? t.disableFullText : t.enableFullText}
              </button>
              <span className="text-sm text-foreground/70">
                {t.fullTextLabel}{" "}
                {feed.fullTextAllowed ? t.fullTextOn : t.fullTextOff}
              </span>
            </form>
          </section>
        ) : viewer && claimable ? (
          <ClaimPanel
            feedId={feed.id}
            ownershipStatus={feed.ownershipStatus as "orphan" | "claimed"}
          />
        ) : viewer ? null : (
          <aside className="rounded border border-black/10 bg-black/[0.03] p-4 text-sm text-foreground/75 dark:border-white/15 dark:bg-white/[0.03]">
            {t.yourBlogBefore}{" "}
            <Link href="/" className="underline">
              {t.yourBlogLink}
            </Link>{" "}
            {t.yourBlogAfter}
          </aside>
        )}

        <section className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">{t.latestItems}</h2>
          {items.length === 0 ? (
            <p className="text-foreground/60">{t.noItems}</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-col gap-1 border-b border-black/5 pb-4 dark:border-white/10"
                >
                  <h3 className="font-medium">
                    <a
                      href={it.link}
                      className="hover:underline"
                      rel="noopener noreferrer nofollow"
                    >
                      {it.title}
                    </a>
                  </h3>
                  <div className="text-xs text-foreground/60">
                    {it.author && <span>{it.author} · </span>}
                    {it.publishedAt && (
                      <time dateTime={it.publishedAt.toISOString()}>
                        {formatLongDate(it.publishedAt, locale)}
                      </time>
                    )}
                  </div>
                  {/* Extrait + lien uniquement (orphelin) ; jamais le texte
                    intégral réhébergé. */}
                  {it.excerpt && (
                    <p className="text-sm text-foreground/80">{it.excerpt}</p>
                  )}
                  <a
                    href={it.link}
                    className="text-sm underline"
                    rel="noopener noreferrer nofollow"
                  >
                    {t.readOnSource}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}
