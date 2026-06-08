/**
 * Backfill des images d'aperçu pour les items RSS déjà en base (antérieurs à
 * l'ajout de `feed_items.image_url`). Pour chaque item sans image :
 *   1. première image du contenu HTML stocké (si `fullTextAllowed` l'a gardé) ;
 *   2. sinon repli og:image / twitter:image en récupérant la page de l'item.
 *
 * URL distante, jamais réhébergée (cf. F3). Best-effort, idempotent (re-jouable :
 * ne touche que les items encore sans image).
 *
 *   npx tsx scripts/backfill-rss-images.ts            # tout, en écrivant
 *   npx tsx scripts/backfill-rss-images.ts --dry-run  # sans écrire
 *   npx tsx scripts/backfill-rss-images.ts --limit=200 # plafonne le nombre traité
 */
import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { db, sql } from "../src/db";
import { feedItems } from "../src/db/schema";
import { fetchOgImage, firstImageInHtml } from "../src/lib/rss";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split("=")[1], 10)) : 0;

async function main() {
  const rows = await db
    .select({
      id: feedItems.id,
      link: feedItems.link,
      contentHtml: feedItems.contentHtml,
    })
    .from(feedItems)
    .where(isNull(feedItems.imageUrl))
    .orderBy(feedItems.fetchedAt);

  const targets = limit > 0 ? rows.slice(0, limit) : rows;
  console.log(
    `${rows.length} item(s) sans image — traitement de ${targets.length}` +
      (dryRun ? " (dry-run)" : ""),
  );

  let fromHtml = 0;
  let fromOg = 0;
  let none = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const item = targets[i];
    // 1. Image inline du contenu stocké (gratuit, sans réseau).
    let image = firstImageInHtml(item.contentHtml, item.link);
    let origin = "html";
    // 2. Sinon repli réseau sur la page de l'item.
    if (!image && item.link) {
      image = await fetchOgImage(item.link);
      origin = "og";
    }

    if (!image) {
      none += 1;
    } else {
      if (origin === "html") fromHtml += 1;
      else fromOg += 1;
      if (!dryRun) {
        await db
          .update(feedItems)
          .set({ imageUrl: image })
          .where(eq(feedItems.id, item.id));
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
      console.log(
        `  …${i + 1}/${targets.length} (html=${fromHtml}, og=${fromOg}, aucune=${none})`,
      );
    }
  }

  console.log(
    `\nTerminé : ${fromHtml} via contenu, ${fromOg} via og:image, ${none} sans image trouvée.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
