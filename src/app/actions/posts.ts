"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { persistMedia, processUpload } from "@/lib/media";
import { deliverCreateNote } from "@/federation/delivery";

export interface PostFormState {
  error?: string;
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
  if (!user) redirect("/login");

  const contentMarkdown = ((formData.get("body") as string) ?? "").trim();
  const file = formData.get("media");
  const hasMedia = file instanceof File && file.size > 0;

  // Un message peut être vide s'il porte un média (image seule).
  if (!contentMarkdown && !hasMedia) {
    return { error: "Le message ne peut pas être vide." };
  }
  if (contentMarkdown.length > MAX_LEN) {
    return { error: `Message trop long (max ${MAX_LEN} caractères).` };
  }

  // Validation du média AVANT toute écriture (rejets type/taille immédiats).
  const alt = ((formData.get("alt") as string) ?? "").trim();
  let processed = null;
  if (hasMedia) {
    const result = await processUpload(file);
    if (!result.ok) return { error: result.error };
    if (result.kind === "image" && !alt) {
      return { error: "Le texte alternatif est obligatoire pour une image." };
    }
    processed = result;
  }

  const contentHtml = renderMarkdown(contentMarkdown);

  const [post] = await db
    .insert(posts)
    .values({ authorId: user.id, contentMarkdown, contentHtml })
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
