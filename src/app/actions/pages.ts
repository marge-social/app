"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sitePages } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { renderMarkdown } from "@/lib/markdown";
import { RESERVED_SLUGS, isValidSlug, toSlug } from "@/lib/pages";

export interface PageFormState {
  error?: string;
  success?: boolean;
}

/**
 * Crée (mode `new`) ou met à jour une page de contenu. Réservé aux admins
 * (`requireAdmin` redirige sinon). Le HTML est sanitisé au rendu avant stockage.
 * Le slug est fixé à la création puis **immuable** (changer l'URL casserait les
 * liens) : en édition il n'est qu'un identifiant transmis en champ caché.
 */
export async function savePageAction(
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  await requireAdmin();

  const isNew = formData.get("isNew") === "1";
  const title = ((formData.get("title") as string) ?? "").trim();
  const contentMarkdown = ((formData.get("content") as string) ?? "").trim();
  if (!title) return { error: "Le titre est requis." };
  if (!contentMarkdown) return { error: "Le contenu ne peut pas être vide." };

  const contentHtml = renderMarkdown(contentMarkdown);
  const now = new Date();

  if (isNew) {
    const raw = ((formData.get("slug") as string) ?? "").trim();
    const slug = toSlug(raw || title);
    if (!isValidSlug(slug)) {
      return { error: "Slug invalide (lettres minuscules, chiffres, tirets)." };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { error: `Le slug « ${slug} » est réservé par une autre page.` };
    }
    const existing = await db.query.sitePages.findFirst({
      where: eq(sitePages.slug, slug),
      columns: { slug: true },
    });
    if (existing) {
      return { error: `Une page « ${slug} » existe déjà.` };
    }
    await db.insert(sitePages).values({
      slug,
      title,
      contentMarkdown,
      contentHtml,
      updatedAt: now,
    });
    revalidatePath(`/${slug}`);
    revalidatePath("/admin/pages");
    redirect(`/admin/pages/${slug}`);
  }

  // Édition : slug immuable transmis en champ caché. Upsert (la page « par
  // défaut » mentions légales n'a pas encore de ligne au premier enregistrement).
  const slug = ((formData.get("slug") as string) ?? "").trim();
  if (!slug) return { error: "Slug manquant." };
  await db
    .insert(sitePages)
    .values({ slug, title, contentMarkdown, contentHtml, updatedAt: now })
    .onConflictDoUpdate({
      target: sitePages.slug,
      set: { title, contentMarkdown, contentHtml, updatedAt: now },
    });
  revalidatePath(`/${slug}`);
  revalidatePath("/admin/pages");
  return { success: true };
}

/**
 * Supprime une page. Réservé aux admins. Supprimer une page « par défaut »
 * (mentions légales) ne fait que la ramener à son contenu par défaut.
 */
export async function deletePageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = ((formData.get("slug") as string) ?? "").trim();
  if (slug) {
    await db.delete(sitePages).where(eq(sitePages.slug, slug));
    revalidatePath(`/${slug}`);
    revalidatePath("/admin/pages");
  }
  redirect("/admin/pages");
}
