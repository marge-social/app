import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { articleUrl } from "@/lib/config";

/**
 * Export de tous les textes de l'utilisateur en un seul fichier Markdown
 * (portabilité des données). Chaque texte est précédé d'un front-matter YAML.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await db.query.articles.findMany({
    where: eq(articles.authorId, user.id),
    orderBy: [asc(articles.createdAt)],
  });

  const docs = rows.map((a) => {
    const date = (a.publishedAt ?? a.createdAt).toISOString();
    const frontmatter = [
      "---",
      `title: ${JSON.stringify(a.title)}`,
      `slug: ${a.slug}`,
      `status: ${a.status}`,
      `date: ${date}`,
      a.status === "published"
        ? `permalink: ${articleUrl(user.handle, a.slug)}`
        : null,
      a.summary ? `summary: ${JSON.stringify(a.summary)}` : null,
      "---",
    ]
      .filter(Boolean)
      .join("\n");
    return `${frontmatter}\n\n# ${a.title}\n\n${a.contentMarkdown}\n`;
  });

  const body =
    docs.length > 0
      ? docs.join("\n\n---\n\n")
      : "# Aucun texte\n\nVous n’avez pas encore écrit de texte.\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="marge-${user.handle}-textes.md"`,
    },
  });
}
