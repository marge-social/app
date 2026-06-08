import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { feedItems, feeds } from "@/db/schema";
import { fetchOgImage, parseFeed } from "@/lib/rss";

/**
 * Plafond de récupérations og:image par flux et par passe : borne le coût réseau
 * du repli quand un flux fraîchement référencé insère des dizaines d'items d'un
 * coup. Les items au-delà restent sans image (couverts à la prochaine passe).
 */
const OG_FETCH_BUDGET = 25;

export interface PollResult {
  feedId: string;
  ok: boolean;
  newItems: number;
  error?: string;
}

type FeedRow = typeof feeds.$inferSelect;

/**
 * Récupère un flux UNE fois et insère ses nouveaux items (dé-doublonnés par
 * GUID). Pour un flux non opt-in au texte intégral : extrait seulement
 * (jamais le contenu réhébergé — respect du droit d'auteur, cf. F3).
 */
export async function pollFeed(feed: FeedRow): Promise<PollResult> {
  try {
    const parsed = await parseFeed(feed.feedUrl, feed.id);

    let inserted = 0;
    let ogBudget = OG_FETCH_BUDGET;
    for (const item of parsed.items) {
      // Repli og:image : seulement pour un item qu'on s'apprête à insérer (donc
      // nouveau, après le premier passage) et sans image détectée dans le flux.
      let imageUrl = item.imageUrl;
      if (!imageUrl && item.link && ogBudget > 0) {
        const existing = await db.query.feedItems.findFirst({
          where: and(
            eq(feedItems.feedId, feed.id),
            eq(feedItems.guid, item.guid),
          ),
          columns: { id: true },
        });
        if (!existing) {
          ogBudget -= 1;
          imageUrl = await fetchOgImage(item.link);
        }
      }
      const res = await db
        .insert(feedItems)
        .values({
          feedId: feed.id,
          guid: item.guid,
          title: item.title,
          link: item.link,
          author: item.author,
          excerpt: item.excerpt,
          // Texte intégral uniquement si le propriétaire l'a explicitement activé.
          contentHtml: feed.fullTextAllowed ? item.contentHtml : null,
          imageUrl,
          publishedAt: item.publishedAt,
        })
        .onConflictDoNothing({
          target: [feedItems.feedId, feedItems.guid],
        })
        .returning({ id: feedItems.id });
      if (res.length > 0) inserted += 1;
    }

    await db
      .update(feeds)
      .set({
        title: feed.title || parsed.title,
        description: feed.description || parsed.description,
        techStatus: "active",
        techError: null,
        lastPolledAt: new Date(),
      })
      .where(eq(feeds.id, feed.id));

    return { feedId: feed.id, ok: true, newItems: inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(feeds)
      .set({
        techStatus: "error",
        techError: message.slice(0, 500),
        lastPolledAt: new Date(),
      })
      .where(eq(feeds.id, feed.id));
    return { feedId: feed.id, ok: false, newItems: 0, error: message };
  }
}

/** Polle tous les flux non opt-out (mutualisé : une seule fois par flux). */
export async function pollAllFeeds(): Promise<PollResult[]> {
  const rows = await db.query.feeds.findMany({
    where: ne(feeds.ownershipStatus, "opt_out"),
  });
  const results: PollResult[] = [];
  for (const feed of rows) {
    results.push(await pollFeed(feed));
  }
  return results;
}
