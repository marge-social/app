"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sitePages } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { LEGAL_SLUG, LEGAL_TITLE } from "@/lib/legal";
import { renderMarkdown } from "@/lib/markdown";

export interface LegalFormState {
  error?: string;
  success?: boolean;
}

/**
 * Enregistre le Markdown de la page « mentions légales » (upsert sur le slug).
 * Réservé aux admins (`requireAdmin` redirige sinon). Le HTML est **sanitisé**
 * au rendu (`renderMarkdown`) avant stockage — sûr à injecter côté public.
 */
export async function saveLegalPageAction(
  _prev: LegalFormState,
  formData: FormData,
): Promise<LegalFormState> {
  await requireAdmin();

  const contentMarkdown = ((formData.get("content") as string) ?? "").trim();
  if (!contentMarkdown) {
    return { error: "Le contenu ne peut pas être vide." };
  }

  const contentHtml = renderMarkdown(contentMarkdown);
  const now = new Date();

  await db
    .insert(sitePages)
    .values({
      slug: LEGAL_SLUG,
      title: LEGAL_TITLE,
      contentMarkdown,
      contentHtml,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sitePages.slug,
      set: { contentMarkdown, contentHtml, updatedAt: now },
    });

  revalidatePath("/mentions-legales");
  revalidatePath("/admin/mentions-legales");
  return { success: true };
}
