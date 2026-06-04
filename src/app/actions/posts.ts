"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
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
  if (!contentMarkdown) return { error: "Le message ne peut pas être vide." };
  if (contentMarkdown.length > MAX_LEN) {
    return { error: `Message trop long (max ${MAX_LEN} caractères).` };
  }

  const contentHtml = renderMarkdown(contentMarkdown);

  const [post] = await db
    .insert(posts)
    .values({ authorId: user.id, contentMarkdown, contentHtml })
    .returning();

  // Fédération aux abonnés (best-effort : la publication a déjà réussi en base).
  await deliverCreateNote(user.handle, post);

  revalidatePath("/");
  return {};
}
