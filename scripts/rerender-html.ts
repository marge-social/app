import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { articles, posts } from "../src/db/schema";
import { renderMarkdown } from "../src/lib/markdown";

/**
 * Re-rend le `content_html` de tous les posts (notes + commentaires) et
 * articles depuis leur source Markdown, avec le pipeline courant. À lancer
 * après une évolution du rendu (ex. : liens externes en `target="_blank"`,
 * auto-lien des domaines nus) pour que le contenu déjà publié en profite —
 * le HTML est figé en base à la publication.
 *
 * Idempotent ; ne touche pas aux contenus distants (jamais à nous).
 *   npx tsx scripts/rerender-html.ts [--dry-run]
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let changedPosts = 0;
  let changedArticles = 0;

  const allPosts = await db
    .select({ id: posts.id, md: posts.contentMarkdown, html: posts.contentHtml })
    .from(posts);
  for (const p of allPosts) {
    const next = renderMarkdown(p.md);
    if (next === p.html) continue;
    changedPosts++;
    if (!dryRun) {
      await db.update(posts).set({ contentHtml: next }).where(eq(posts.id, p.id));
    }
  }

  const allArticles = await db
    .select({
      id: articles.id,
      md: articles.contentMarkdown,
      html: articles.contentHtml,
    })
    .from(articles);
  for (const a of allArticles) {
    const next = renderMarkdown(a.md);
    if (next === a.html) continue;
    changedArticles++;
    if (!dryRun) {
      await db
        .update(articles)
        .set({ contentHtml: next })
        .where(eq(articles.id, a.id));
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}posts re-rendus : ${changedPosts}/${allPosts.length} ; ` +
      `articles re-rendus : ${changedArticles}/${allArticles.length}`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
