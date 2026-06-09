import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { articles, follows, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { buildFeed } from "@/lib/feed";
import { AppShell } from "@/components/AppShell";
import { DiscoverShell } from "@/components/discover/DiscoverShell";
import { Portal } from "@/components/portal/Portal";
import type { MeSummary } from "@/components/discover/LeftRail";

const PAGE_SIZE = 20;

const DOT_COLORS = ["#7A4A22", "#3F6F8F", "#7E5C8E", "#406B4A", "#8B3A1F", "#5A5A2A", "#6E4A4A", "#1F4E7A"];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DOT_COLORS[h % DOT_COLORS.length];
}

/** Statistiques de profil réellement disponibles : nombre de textes publiés
 *  (billets + notes top-level) et nombre d'abonnés acceptés. Les autres signaux
 *  du prototype (citations, % lectures complètes) ne sont pas suivis en base. */
async function loadMeSummary(user: {
  id: string;
  handle: string;
  displayName: string;
  avatarUpdatedAt: Date | null;
}): Promise<MeSummary> {
  const [articleCount, noteCount, followerCount] = await Promise.all([
    db
      .select({ c: count() })
      .from(articles)
      .where(and(eq(articles.authorId, user.id), eq(articles.status, "published"))),
    db
      .select({ c: count() })
      .from(posts)
      .where(and(eq(posts.authorId, user.id), isNull(posts.inReplyToUri))),
    db
      .select({ c: count() })
      .from(follows)
      .where(and(eq(follows.followingUserId, user.id), eq(follows.status, "accepted"))),
  ]);

  return {
    name: user.displayName,
    handle: user.handle,
    fediHandle: fediverseHandle(user.handle),
    avatarSrc: user.avatarUpdatedAt
      ? `/api/avatar/${user.handle}?v=${user.avatarUpdatedAt.getTime()}`
      : null,
    color: colorFor(user.handle),
    textes: (articleCount[0]?.c ?? 0) + (noteCount[0]?.c ?? 0),
    abonnes: followerCount[0]?.c ?? 0,
  };
}

/**
 * Home « Découvrir » — écran principal. Connecté : carte profil réelle (rail
 * gauche) + fil unifié réel (`buildFeed`) sous le chrome global. Déconnecté :
 * portail visiteur plein écran (manifeste + carte d'authentification), autonome
 * du chrome global. Aucune donnée de démo : le contenu provient de la base.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <Portal />;

  const { n } = await searchParams;
  const pages = Math.max(1, Math.min(20, Number.parseInt(n ?? "1", 10) || 1));
  const limit = pages * PAGE_SIZE;

  const [{ entries, hasMore }, me] = await Promise.all([
    buildFeed(
      { id: user.id, handle: user.handle, displayName: user.displayName },
      { limit },
    ),
    loadMeSummary(user),
  ]);

  return (
    <AppShell>
      <DiscoverShell
        me={me}
        entries={entries}
        hasMore={hasMore}
        nextHref={`/?n=${pages + 1}`}
      />
    </AppShell>
  );
}
