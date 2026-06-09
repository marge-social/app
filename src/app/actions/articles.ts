"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { actorUri, articleApUri, fediverseHandle } from "@/lib/config";
import { renderMarkdown, slugify } from "@/lib/markdown";
import { persistMedia, processUpload } from "@/lib/media";
import { resolveInteractionTarget } from "@/lib/interactions";
import { routeInteractionNotification } from "@/lib/notifications";
import {
  deliverCreate,
  deliverDelete,
  deliverUpdate,
} from "@/federation/delivery";

export interface ArticleFormState {
  /** Clé i18n (dict.errors), traduite au rendu. */
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
  if (!user) redirect("/");

  const id = (formData.get("id") as string) || undefined;
  const title = ((formData.get("title") as string) ?? "").trim();
  const contentMarkdown = ((formData.get("content") as string) ?? "").trim();
  const summaryInput = ((formData.get("summary") as string) ?? "").trim();
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";
  // Réponse-billet (§2.3) : IRI du contenu d'origine, posé seulement à la
  // création (sur édition, on conserve le rattachement existant).
  const inReplyTo = ((formData.get("inReplyTo") as string) ?? "").trim();

  if (!title) return { error: "titleRequired" };
  if (!contentMarkdown) return { error: "contentEmpty" };

  // Pièce jointe (à la création uniquement, comme inReplyTo). Validation AVANT
  // toute écriture pour rejeter type/taille immédiatement.
  const file = formData.get("media");
  const alt = ((formData.get("alt") as string) ?? "").trim();
  let processed = null;
  if (!id && file instanceof File && file.size > 0) {
    const result = await processUpload(file);
    if (!result.ok) return { error: result.error };
    if (result.kind === "image" && !alt) {
      return { error: "altRequired" };
    }
    processed = result;
  }

  const contentHtml = renderMarkdown(contentMarkdown);
  // On stocke le chapô explicite de l'auteur tel quel (souvent vide) ; le
  // résumé effectif est dérivé du contenu à l'affichage/fédération, donc
  // toujours frais. Voir effectiveSummary().
  const summary = summaryInput;
  const now = new Date();

  let slug: string;
  let articleId: string;

  // `create` = première mise en ligne (émettra Create) ; `update` = ré-édition
  // d'un article déjà publié (émettra Update).
  let federate: "create" | "update" | null = null;

  if (id) {
    // Édition : on vérifie la propriété et on conserve le slug existant.
    const existing = await db.query.articles.findFirst({
      where: eq(articles.id, id),
    });
    if (!existing || existing.authorId !== user.id) {
      return { error: "articleNotFound" };
    }
    slug = existing.slug;
    const wasPublished = existing.status === "published";
    if (intent === "publish") federate = wasPublished ? "update" : "create";
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
        apUri:
          existing.apUri ??
          (intent === "publish" ? articleApUri(user.handle, slug) : null),
        updatedAt: now,
      })
      .where(eq(articles.id, id));
    articleId = id;
  } else {
    // Création.
    slug = await uniqueSlug(user.id, slugify(title));
    if (intent === "publish") federate = "create";
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
        apUri: intent === "publish" ? articleApUri(user.handle, slug) : null,
        inReplyToUri: inReplyTo || null,
      })
      .returning({ id: articles.id });
    articleId = created.id;

    // Téléversement S3 + persistance du média, rattaché au nouvel article.
    if (processed) {
      try {
        await persistMedia({
          ownerUserId: user.id,
          processed,
          altText: alt || null,
          articleId,
        });
      } catch (err) {
        console.error("[media] échec du téléversement (article) :", err);
      }
    }
  }

  // Fédération sortante (après écriture en base).
  if (federate) {
    const row = await db.query.articles.findFirst({
      where: eq(articles.id, articleId),
    });
    if (row) {
      if (federate === "create") {
        // Réponse-billet (§2.3) : à la 1re mise en ligne, notifier l'auteur
        // d'origine en temps réel (§4.3, sauf auto-réponse) s'il est local, ou
        // fédérer la réponse à son instance s'il est distant.
        let parentAuthorActorUri: string | null = null;
        if (row.inReplyToUri) {
          const target = await resolveInteractionTarget(row.inReplyToUri);
          if (target?.authorIsLocal) {
            if (target.authorUserId && target.authorUserId !== user.id) {
              await routeInteractionNotification({
                recipientUserId: target.authorUserId,
                type: "reply",
                origin: "local",
                actor: {
                  uri: actorUri(user.handle),
                  handle: fediverseHandle(user.handle),
                  name: user.displayName,
                },
                objectUri: row.inReplyToUri,
              });
            }
          } else if (target) {
            parentAuthorActorUri = target.authorActorUri;
          }
        }
        await deliverCreate(user.handle, row, parentAuthorActorUri);
      } else {
        await deliverUpdate(user.handle, row);
      }
    }
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
  if (!user) redirect("/");
  const id = formData.get("id") as string;
  if (!id) redirect("/compose");

  const existing = await db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
  if (existing && existing.authorId === user.id) {
    const wasPublished = existing.status === "published";
    await db.delete(articles).where(eq(articles.id, id));
    // Émet Delete(Tombstone) si l'article était publié/fédéré.
    if (wasPublished) await deliverDelete(user.handle, existing.slug);
    revalidatePath(`/@${user.handle}`);
  }
  redirect(`/@${user.handle}`);
}
