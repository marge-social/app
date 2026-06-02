import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { EditorForm } from "@/components/EditorForm";
import { deleteArticleAction } from "@/app/actions/articles";
import { getCurrentUser } from "@/lib/auth";
import { articleUrl } from "@/lib/config";

interface EditParams {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: EditParams) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const article = await db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
  if (!article || article.authorId !== user.id) notFound();

  const published = article.status === "published";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {published ? "Modifier le texte" : "Modifier le brouillon"}
        </h1>
        {published && (
          <Link
            href={articleUrl(user.handle, article.slug)}
            className="text-sm underline"
          >
            Voir la page publique
          </Link>
        )}
      </div>

      <EditorForm
        article={{
          id: article.id,
          title: article.title,
          summary: article.summary,
          contentMarkdown: article.contentMarkdown,
          status: article.status,
        }}
      />

      <form
        action={deleteArticleAction}
        className="border-t border-black/10 pt-6 dark:border-white/15"
      >
        <input type="hidden" name="id" value={article.id} />
        <button
          type="submit"
          className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
        >
          Supprimer ce texte
        </button>
      </form>
    </div>
  );
}
