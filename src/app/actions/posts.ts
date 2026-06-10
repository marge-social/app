"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { persistMedia, processUpload } from "@/lib/media";
import { extractUrls, fetchLinkPreview } from "@/lib/og";
import {
  deliverCreateNote,
  deliverDeleteNote,
  deliverUpdateNote,
} from "@/federation/delivery";

export interface PostFormState {
  /** Clé i18n (dict.errors) — traduite au rendu via useActionMessage(). */
  error?: string;
  errorParams?: Record<string, string | number>;
}

const MAX_LEN = 5000;

/**
 * Publie un message court (Note) depuis le composer de la home (§Lot 3).
 * Un seul champ : le corps Markdown. Publication immédiate + fédération aux
 * abonnés (réutilise le pipeline de rendu/sanitisation des articles).
 */
export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const contentMarkdown = ((formData.get("body") as string) ?? "").trim();
  const file = formData.get("media");
  const hasMedia = file instanceof File && file.size > 0;

  // Un message peut être vide s'il porte un média (image seule).
  if (!contentMarkdown && !hasMedia) {
    return { error: "messageEmpty" };
  }
  if (contentMarkdown.length > MAX_LEN) {
    return { error: "messageTooLong", errorParams: { n: MAX_LEN } };
  }

  // Validation du média AVANT toute écriture (rejets type/taille immédiats).
  const alt = ((formData.get("alt") as string) ?? "").trim();
  let processed = null;
  if (hasMedia) {
    const result = await processUpload(file);
    if (!result.ok) return { error: result.error };
    if (result.kind === "image" && !alt) {
      return { error: "altRequired" };
    }
    processed = result;
  }

  const contentHtml = renderMarkdown(contentMarkdown);

  // Vignette du lien mis en avant : le client ne transmet que l'URL choisie
  // ("" = aucune) ; elle doit être présente dans le texte, et l'aperçu est
  // résolu côté serveur (jamais fourni par le client). Best-effort.
  const linkUrl = ((formData.get("linkUrl") as string) ?? "").trim();
  let linkPreview = null;
  if (linkUrl && extractUrls(contentMarkdown).includes(linkUrl)) {
    linkPreview = await fetchLinkPreview(linkUrl);
  }

  const [post] = await db
    .insert(posts)
    .values({ authorId: user.id, contentMarkdown, contentHtml, linkPreview })
    .returning();

  // Téléversement S3 + persistance du média, rattaché au post (best-effort :
  // un échec S3 ne doit pas perdre le message déjà publié).
  if (processed) {
    try {
      await persistMedia({
        ownerUserId: user.id,
        processed,
        altText: alt || null,
        postId: post.id,
      });
    } catch (err) {
      console.error("[media] échec du téléversement (post) :", err);
    }
  }

  // Fédération aux abonnés (best-effort : la publication a déjà réussi en base).
  await deliverCreateNote(user.handle, post);

  revalidatePath("/");
  return {};
}

/**
 * Édite un message court de l'utilisateur courant (texte seul — le média
 * attaché est conservé tel quel en V1). Ré-applique le pipeline de rendu puis
 * fédère un `Update(Note)` aux abonnés.
 */
export async function updatePostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const id = (formData.get("id") as string) ?? "";
  const contentMarkdown = ((formData.get("body") as string) ?? "").trim();

  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, user.id)),
  });
  if (!existing) return { error: "notFound" };

  // Un message peut être vide s'il porte un média (image seule).
  if (!contentMarkdown) {
    const attached = await db.query.media.findFirst({
      where: eq(media.postId, existing.id),
    });
    if (!attached) return { error: "messageEmpty" };
  }
  if (contentMarkdown.length > MAX_LEN) {
    return { error: "messageTooLong", errorParams: { n: MAX_LEN } };
  }

  // Vignette : le formulaire d'édition envoie l'URL choisie ("" = aucune),
  // qui doit figurer dans le texte. Si elle est inchangée on conserve
  // l'aperçu stocké (pas de re-fetch) ; sinon on le re-résout côté serveur
  // (jamais fourni par le client).
  const linkUrl = ((formData.get("linkUrl") as string) ?? "").trim();
  let linkPreview = null;
  if (linkUrl && extractUrls(contentMarkdown).includes(linkUrl)) {
    linkPreview =
      existing.linkPreview?.url === linkUrl
        ? existing.linkPreview
        : await fetchLinkPreview(linkUrl);
  }

  const [updated] = await db
    .update(posts)
    .set({
      contentMarkdown,
      contentHtml: renderMarkdown(contentMarkdown),
      linkPreview,
    })
    .where(eq(posts.id, existing.id))
    .returning();

  // Fédération best-effort : l'édition a déjà réussi en base.
  await deliverUpdateNote(user.handle, updated);

  revalidatePath("/");
  revalidatePath(`/@${user.handle}/notes/${existing.id}`);
  return {};
}

/**
 * Supprime un message court de l'utilisateur courant, avec émission d'un
 * `Delete(Tombstone)` fédéré (même mécanique que les articles). Les médias
 * attachés suivent en cascade (FK `media.post_id`).
 */
export async function deletePostAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const id = (formData.get("id") as string) ?? "";
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, user.id)),
  });
  if (existing) {
    await db.delete(posts).where(eq(posts.id, existing.id));
    await deliverDeleteNote(user.handle, existing.id);
    revalidatePath("/");
  }
  redirect("/");
}
