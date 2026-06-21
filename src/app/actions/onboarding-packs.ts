"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { onboardingItemType, onboardingPackItems, onboardingPacks } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

export interface PackFormState {
  error?: string;
  success?: boolean;
}

const ITEM_TYPES = new Set(onboardingItemType.enumValues);

/** Crée un pack d'onboarding (admin), puis ouvre son éditeur. */
export async function createPackAction(
  _prev: PackFormState,
  formData: FormData,
): Promise<PackFormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim();
  if (!name) return { error: "packNameRequired" };

  // Place le nouveau pack en fin de liste.
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${onboardingPacks.position}), -1) + 1` })
    .from(onboardingPacks);

  const [pack] = await db
    .insert(onboardingPacks)
    .values({ name, tag, position: next })
    .returning({ id: onboardingPacks.id });

  revalidatePath("/admin/onboarding");
  redirect(`/admin/onboarding/${pack.id}`);
}

/** Met à jour le nom/sous-titre/activation d'un pack. */
export async function updatePackAction(
  _prev: PackFormState,
  formData: FormData,
): Promise<PackFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  if (!id) return { error: "packNotFound" };
  if (!name) return { error: "packNameRequired" };

  await db
    .update(onboardingPacks)
    .set({ name, tag, enabled })
    .where(eq(onboardingPacks.id, id));

  revalidatePath("/admin/onboarding");
  revalidatePath(`/admin/onboarding/${id}`);
  return { success: true };
}

/** Supprime un pack (et ses items en cascade). */
export async function deletePackAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db.delete(onboardingPacks).where(eq(onboardingPacks.id, id));
    revalidatePath("/admin/onboarding");
  }
  redirect("/admin/onboarding");
}

/** Ajoute un item (compte ou flux) à un pack. */
export async function addPackItemAction(
  _prev: PackFormState,
  formData: FormData,
): Promise<PackFormState> {
  await requireAdmin();
  const packId = String(formData.get("packId") ?? "");
  const type = String(formData.get("type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim();
  if (!packId) return { error: "packNotFound" };
  if (!ITEM_TYPES.has(type as never)) return { error: "packItemTypeInvalid" };
  if (!label) return { error: "packItemLabelRequired" };
  if (!ref) return { error: "packItemRefRequired" };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${onboardingPackItems.position}), -1) + 1` })
    .from(onboardingPackItems)
    .where(eq(onboardingPackItems.packId, packId));

  await db.insert(onboardingPackItems).values({
    packId,
    type: type as (typeof onboardingItemType.enumValues)[number],
    label,
    ref,
    position: next,
  });

  revalidatePath(`/admin/onboarding/${packId}`);
  return { success: true };
}

/** Retire un item d'un pack. */
export async function removePackItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const packId = String(formData.get("packId") ?? "");
  if (id) {
    await db.delete(onboardingPackItems).where(eq(onboardingPackItems.id, id));
    if (packId) revalidatePath(`/admin/onboarding/${packId}`);
  }
}
