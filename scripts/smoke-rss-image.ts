/**
 * Test fumée de la détection d'image des items RSS. Vérifie les 4 sources
 * (Media RSS, enclosure, <img> du contenu, og:image en repli) contre les
 * fixtures servies par le serveur de dev (localhost:3000).
 *
 *   npm run dev    # dans un autre terminal
 *   npx tsx scripts/smoke-rss-image.ts
 */
import { fetchOgImage, parseFeed } from "../src/lib/rss";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

async function main() {
  const feed = await parseFeed(`${BASE}/test-feed.xml`);
  const byTitle = new Map(feed.items.map((i) => [i.title, i]));

  const item1 = byTitle.get("Premier billet de test");
  assert(
    item1?.imageUrl?.includes("seed/marge1"),
    `media:content détecté → ${item1?.imageUrl}`,
  );

  const item2 = byTitle.get("Deuxième billet de test");
  assert(
    item2?.imageUrl?.includes("seed/marge2"),
    `enclosure image détectée → ${item2?.imageUrl}`,
  );

  const item3 = byTitle.get("Troisième billet de test");
  assert(
    item3?.imageUrl?.includes("seed/marge3"),
    `<img> du contenu détecté → ${item3?.imageUrl}`,
  );

  const og = await fetchOgImage(`${BASE}/test-blog.html`);
  assert(og?.includes("seed/marge-og"), `repli og:image → ${og}`);

  console.log(process.exitCode ? "\nÉCHEC" : "\nOK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
