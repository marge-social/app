"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  deriveSummary,
  renderMarkdown,
  slugify,
} from "@/lib/markdown";

export interface ArticleFormState {
  error?: string;
}

/** Garantit un slug unique par auteur en suffixant -2, -3… si besoin. */
async function uniqueSlug(
  authorId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  let n = 1;
  // Boucle bornée : on cherche un slug libre.
  while (true) {
    const clash = await db.query.articles.findFirst({
      where: and(
        eq(articles.authorId, authorId),
        eq(articles.slug, candidate),
        excludeId ? ne(articles.id, excludeId) : undefined,
      ),
      columns: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

/**
 * Crée ou met à jour un article. `intent` vaut "draft" ou "publish".
 * Le slug est fixé à la création et reste stable (permalien stable).
 */
export async function saveArticleAction(
  _prev: ArticleFormState,
  formData: FormData,
): Promise<ArticleFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = (formData.get("id") as string) || undefined;
  const title = ((formData.get("title") as string) ?? "").trim();
  const contentMarkdown = ((formData.get("content") as string) ?? "").trim();
  const summaryInput = ((formData.get("summary") as string) ?? "").trim();
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";

  if (!title) return { error: "Le titre est requis." };
  if (!contentMarkdown) return { error: "Le contenu ne peut pas être vide." };

  const contentHtml = renderMarkdown(contentMarkdown);
  const summary = deriveSummary(contentMarkdown, summaryInput);
  const now = new Date();

  let slug: string;
  let articleId: string;

  if (id) {
    // Édition : on vérifie la propriété et on conserve le slug existant.
    const existing = await db.query.articles.findFirst({
      where: eq(articles.id, id),
    });
    if (!existing || existing.authorId !== user.id) {
      return { error: "Article introuvable." };
    }
    slug = existing.slug;
    const wasPublished = existing.status === "published";
    await db
      .update(articles)
      .set({
        title,
        contentMarkdown,
        contentHtml,
        summary,
        status: intent === "publish" ? "published" : existing.status,
        publishedAt:
          intent === "publish" && !wasPublished ? now : existing.publishedAt,
        updatedAt: now,
      })
      .where(eq(articles.id, id));
    articleId = id;
  } else {
    // Création.
    slug = await uniqueSlug(user.id, slugify(title));
    const [created] = await db
      .insert(articles)
      .values({
        authorId: user.id,
        title,
        contentMarkdown,
        contentHtml,
        summary,
        slug,
        status: intent === "publish" ? "published" : "draft",
        publishedAt: intent === "publish" ? now : null,
      })
      .returning({ id: articles.id });
    articleId = created.id;
  }

  revalidatePath(`/@${user.handle}`);
  revalidatePath(`/@${user.handle}/${slug}`);

  if (intent === "publish") {
    redirect(`/@${user.handle}/${slug}`);
  }
  // Brouillon : on retourne à l'éditeur de cet article.
  redirect(`/compose/${articleId}`);
}

/** Supprime un article de l'utilisateur courant. */
export async function deleteArticleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = formData.get("id") as string;
  if (!id) redirect("/compose");

  const existing = await db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
  if (existing && existing.authorId === user.id) {
    await db.delete(articles).where(eq(articles.id, id));
    revalidatePath(`/@${user.handle}`);
  }
  redirect(`/@${user.handle}`);
}
