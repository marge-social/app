import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { articles, users } from "@/db/schema";
import { Attachments } from "@/components/Attachments";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { loadMediaForArticles } from "@/lib/media";
import { readingTimeMinutes } from "@/lib/markdown";

interface ArticleParams {
  params: Promise<{ handle: string; slug: string }>;
}

async function loadArticle(rawHandle: string, slug: string) {
  const decoded = decodeURIComponent(rawHandle);
  if (!decoded.startsWith("@")) return null;
  const handle = decoded.slice(1).toLowerCase();

  const author = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (!author) return null;

  const article = await db.query.articles.findFirst({
    where: and(eq(articles.authorId, author.id), eq(articles.slug, slug)),
  });
  if (!article) return null;
  return { author, article };
}

export async function generateMetadata({
  params,
}: ArticleParams): Promise<Metadata> {
  const { handle, slug } = await params;
  const data = await loadArticle(handle, slug);
  if (!data) return { title: "Introuvable — Marge" };
  return {
    title: `${data.article.title} — ${data.author.displayName}`,
    description: data.article.summary || undefined,
  };
}

export default async function ArticlePage({ params }: ArticleParams) {
  const { handle, slug } = await params;
  const data = await loadArticle(handle, slug);
  if (!data) notFound();
  const { author, article } = data;

  const viewer = await getCurrentUser();
  const isAuthor = viewer?.id === author.id;

  // Les brouillons ne sont visibles que par leur auteur.
  if (article.status !== "published" && !isAuthor) notFound();

  const date = article.publishedAt ?? article.createdAt;
  const media = (await loadMediaForArticles([article.id])).get(article.id) ?? [];

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {article.status !== "published" && (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Brouillon — visible par toi seul·e.
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>
        <p className="text-sm text-foreground/70">
          <Link href={`/@${author.handle}`} className="hover:underline">
            {author.displayName}
          </Link>{" "}
          <span className="font-mono">{fediverseHandle(author.handle)}</span>
          {" · "}
          <time dateTime={date.toISOString()}>
            {date.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          {" · "}
          {readingTimeMinutes(article.contentMarkdown)} min de lecture
        </p>
        {isAuthor && (
          <Link
            href={`/compose/${article.id}`}
            className="w-fit text-sm underline"
          >
            Modifier
          </Link>
        )}
      </header>

      <Attachments media={media} />

      <div
        className="prose-marge"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />
    </article>
  );
}
