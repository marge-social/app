import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  articles,
  feedSubscriptions,
  feeds,
  follows,
  users,
} from "@/db/schema";
import { followLocalAction, unfollowLocalAction } from "@/app/actions/follows";
import {
  subscribeFeedAction,
  unsubscribeFeedAction,
} from "@/app/actions/feeds";
import { removeOwnFeedAction } from "@/app/actions/profile";
import { Container } from "@/components/Container";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { ProfileHandle } from "@/components/ProfileHandle";
import { ReferenceFeedForm } from "@/components/ReferenceFeedForm";
import { SitePageView } from "@/components/SitePageView";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { effectiveSummary, readingTimeMinutes } from "@/lib/markdown";
import { getPage } from "@/lib/pages";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatLongDate } from "@/lib/relative-time";

interface ProfileParams {
  params: Promise<{ handle: string }>;
}

/**
 * Segment racine : un profil `/@handle` (préfixe « @ ») OU une page de contenu
 * éditable `/slug` (sans « @ », ex. `/mentions-legales`). Les routes statiques
 * (`/signup`, `/feeds`…) priment sur cette route dynamique.
 */
export async function generateMetadata({
  params,
}: ProfileParams): Promise<Metadata> {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) {
    const page = await getPage(decoded.toLowerCase());
    return { title: page ? `${page.title} — marge` : "marge" };
  }
  const profile = await db.query.users.findFirst({
    where: eq(users.handle, decoded.slice(1).toLowerCase()),
    columns: { displayName: true },
  });
  return { title: profile ? `${profile.displayName} — marge` : "marge" };
}

export default async function ProfilePage({ params }: ProfileParams) {
  // Next.js fournit le segment encodé (« %40claire ») : on décode avant test.
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  // Sans préfixe « @ » → page de contenu éditable (slug). Sinon, profil.
  if (!decoded.startsWith("@")) {
    const page = await getPage(decoded.toLowerCase());
    if (!page) notFound();
    return (
      <Container>
        <SitePageView page={page} />
      </Container>
    );
  }
  const handle = decoded.slice(1).toLowerCase();

  const profile = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;
  const { locale, dict } = await getServerI18n();
  const t = dict.profile;

  const isFollowing = viewer
    ? !!(await db.query.follows.findFirst({
        where: and(
          eq(follows.followerUserId, viewer.id),
          eq(follows.followingUserId, profile.id),
        ),
        columns: { id: true },
      }))
    : false;

  // Flux RSS déclarés (réclamés) par cet auteur.
  const declaredFeeds = await db.query.feeds.findMany({
    where: eq(feeds.ownerId, profile.id),
    columns: { id: true, title: true, feedUrl: true, description: true },
  });
  const mySubs = viewer
    ? new Set(
        (
          await db
            .select({ feedId: feedSubscriptions.feedId })
            .from(feedSubscriptions)
            .where(eq(feedSubscriptions.userId, viewer.id))
        ).map((r) => r.feedId),
      )
    : new Set<string>();

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

  // Flux gérables par le propriétaire : réclamés OU simplement référencés par lui.
  const managedFeeds = isSelf
    ? await db.query.feeds.findMany({
        where: or(
          eq(feeds.ownerId, profile.id),
          eq(feeds.referencedBy, profile.id),
        ),
        orderBy: [desc(feeds.createdAt)],
        columns: {
          id: true,
          title: true,
          feedUrl: true,
          ownershipStatus: true,
        },
      })
    : [];

  const avatarSrc = profile.avatarUpdatedAt
    ? `/api/avatar/${profile.handle}?v=${profile.avatarUpdatedAt.getTime()}`
    : null;

  const initial = profile.displayName.charAt(0).toUpperCase();
  const fedHandle = fediverseHandle(profile.handle);

  return (
    <div className="pf-shell">
      <div className="pf-main">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <header className="pf-hero">
          <div className="pf-hero-main">
            <span className="pf-avatar-ring">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={interpolate(t.avatarAlt, { name: profile.displayName })}
                  width={96}
                  height={96}
                  className="pf-avatar"
                />
              ) : (
                <span className="pf-avatar" aria-hidden="true">
                  {initial}
                </span>
              )}
            </span>

            <div className="pf-hero-id">
              <div className="pf-name-row">
                <h1 className="pf-name">{profile.displayName}</h1>
              </div>
              <div className="pf-idline">
                <ProfileHandle handle={fedHandle} />
              </div>
              {profile.bio && <p className="pf-bio">{profile.bio}</p>}
            </div>

            <div className="pf-hero-actions">
              {!isSelf && viewer && (
                // Suivi du COMPTE (fédéré). Distinct et jamais couplé au suivi
                // des flux RSS de l'auteur (cf. §2).
                <form
                  action={isFollowing ? unfollowLocalAction : followLocalAction}
                >
                  <input type="hidden" name="targetUserId" value={profile.id} />
                  <button
                    type="submit"
                    className={`btn ${isFollowing ? "btn-ghost" : "btn-ink"}`}
                  >
                    {isFollowing ? t.unfollowAccount : t.followAccount}
                  </button>
                </form>
              )}
            </div>
          </div>

          <p className="fed-note">
            <span className="fed-note-ic" aria-hidden="true">
              ⁂
            </span>
            <span>
              {t.fedNoteBefore} <b>{fedHandle}</b>
              {t.fedNoteAfter}
            </span>
          </p>

          {!isSelf && !viewer && (
            <p className="pf-empty">
              <Link href="/" className="underline">
                {t.loginToFollowLink}
              </Link>{" "}
              {t.loginToFollowSuffix}
            </p>
          )}
        </header>

        {isSelf && (
          <details className="pf-owner-panel">
            <summary className="pf-owner-summary">{t.editProfile}</summary>
            <div className="pf-owner-body">
              <ProfileEditForm
                displayName={profile.displayName}
                bio={profile.bio}
              />
            </div>
          </details>
        )}

        {/* ─── Articles & contributions ─────────────────────────── */}
        <section className="contrib" aria-labelledby="articles-heading">
          <div className="sec-head">
            <h2 id="articles-heading" className="sec-title">
              {t.contributionsTitle}
            </h2>
            {published.length > 0 && (
              <span className="sec-kicker">{published.length}</span>
            )}
          </div>
          {published.length === 0 ? (
            <p className="pf-empty">{t.noPublished}</p>
          ) : (
            <div className="stream">
              {published.map((a) => (
                <Link
                  key={a.id}
                  href={`/@${profile.handle}/${a.slug}`}
                  className="text-card"
                >
                  <div className="tc-titlerow">
                    <h3 className="tc-title">{a.title}</h3>
                    {a.publishedAt && (
                      <time
                        dateTime={a.publishedAt.toISOString()}
                        className="tc-date"
                      >
                        {formatLongDate(a.publishedAt, locale)}
                      </time>
                    )}
                  </div>
                  <p className="tc-chapo">
                    {effectiveSummary(a.contentMarkdown, a.summary)}
                  </p>
                  <div className="tc-foot">
                    <span className="tc-read">
                      {interpolate(dict.article.readingTime, {
                        n: readingTimeMinutes(a.contentMarkdown),
                      })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── Flux RSS déclarés ────────────────────────────────── */}
        <section className="contrib" aria-labelledby="feeds-heading">
          <div className="sec-head">
            <h2 id="feeds-heading" className="sec-title">
              {t.declaredFeeds}
            </h2>
            {declaredFeeds.length > 0 && (
              <span className="sec-kicker">{declaredFeeds.length}</span>
            )}
          </div>
          {declaredFeeds.length === 0 ? (
            <p className="pf-empty">{t.noDeclaredFeeds}</p>
          ) : (
            <div className="pf-feeds">
              {declaredFeeds.map((f) => {
                const subscribed = mySubs.has(f.id);
                return (
                  <div key={f.id} className="pf-feed">
                    <div className="pf-feed-body">
                      <Link href={`/feeds/${f.id}`} className="pf-feed-title">
                        {f.title || f.feedUrl}
                      </Link>
                      {f.description && (
                        <p className="pf-feed-desc">{f.description}</p>
                      )}
                    </div>
                    {viewer && (
                      // Suivi du FLUX, distinct du suivi du compte (§2).
                      <form
                        action={
                          subscribed
                            ? unsubscribeFeedAction
                            : subscribeFeedAction
                        }
                      >
                        <input type="hidden" name="feedId" value={f.id} />
                        <button type="submit" className="btn btn-ghost">
                          {subscribed ? t.unfollowFeed : t.followFeed}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {isSelf && (
          <section className="contrib" aria-labelledby="manage-feeds-heading">
            <div className="sec-head">
              <h2 id="manage-feeds-heading" className="sec-title">
                {t.addMyFeed}
              </h2>
            </div>
            <p className="pf-feed-desc" style={{ margin: "12px 0 0" }}>
              {t.addMyFeedHelp}
            </p>
            <div className="pf-owner-body" style={{ border: 0, padding: 0, marginTop: 16 }}>
              <ReferenceFeedForm />
            </div>

            {managedFeeds.length > 0 && (
              <div className="pf-managed">
                {managedFeeds.map((f) => (
                  <div key={f.id} className="pf-managed-row">
                    <Link href={`/feeds/${f.id}`}>{f.title || f.feedUrl}</Link>
                    <span className="pf-tag">
                      {f.ownershipStatus === "claimed"
                        ? t.feedClaimed
                        : t.feedReferenced}
                    </span>
                    <form action={removeOwnFeedAction}>
                      <input type="hidden" name="feedId" value={f.id} />
                      <button type="submit" className="pf-link-btn">
                        {t.removeFeed}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ─── Rail droit — « En un coup d'œil » ──────────────────── */}
      <aside className="pf-rail">
        <div className="rail-card">
          <h3 className="rail-h">{t.atAGlance}</h3>
          <div className="glance">
            <div className="glance-row">
              <span className="glance-k">{t.publishedTexts}</span>
              <span className="glance-v">{published.length}</span>
            </div>
            <div className="glance-row">
              <span className="glance-k">{t.declaredFeeds}</span>
              <span className="glance-v brick">{declaredFeeds.length}</span>
            </div>
          </div>
        </div>

        {published[0] && (
          <div className="rail-card">
            <h3 className="rail-h">{t.pinnedText}</h3>
            <Link
              href={`/@${profile.handle}/${published[0].slug}`}
              className="pin-mini-title"
            >
              {published[0].title}
            </Link>
            <div className="pin-mini-meta">
              {interpolate(dict.article.readingTime, {
                n: readingTimeMinutes(published[0].contentMarkdown),
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
