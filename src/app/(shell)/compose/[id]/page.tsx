import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { Container } from "@/components/Container";
import { ArticleEditor } from "@/components/editor/ArticleEditor";
import { deleteArticleAction } from "@/app/actions/articles";
import { getCurrentUser } from "@/lib/auth";
import { articleUrl } from "@/lib/config";
import { getServerI18n } from "@/lib/i18n/server";

interface EditParams {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: EditParams) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;

  const article = await db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
  if (!article || article.authorId !== user.id) notFound();

  const published = article.status === "published";
  const { dict } = await getServerI18n();
  const t = dict.compose;

  return (
    <>
      <ArticleEditor
        article={{
          id: article.id,
          title: article.title,
          summary: article.summary,
          contentMarkdown: article.contentMarkdown,
          status: article.status,
        }}
      />

      <Container>
        <div className="flex items-center justify-between gap-4 border-t border-rule pt-6">
          {published ? (
            <Link
              href={articleUrl(user.handle, article.slug)}
              className="text-sm underline"
            >
              {t.viewPublicPage}
            </Link>
          ) : (
            <span />
          )}
          <form action={deleteArticleAction}>
            <input type="hidden" name="id" value={article.id} />
            <button
              type="submit"
              className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
            >
              {t.deleteText}
            </button>
          </form>
        </div>
      </Container>
    </>
  );
}
