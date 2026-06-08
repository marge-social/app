"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feedSubscriptions, feeds, media, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { persistMedia, processUpload } from "@/lib/media";
import { deleteObject } from "@/lib/storage";

export interface ProfileFormState {
  /** Clés i18n (dict.errors / dict.success), traduites au rendu. */
  error?: string;
  errorParams?: Record<string, string | number>;
  success?: string;
}

const NAME_MAX = 80;
const BIO_MAX = 500;

/** Met à jour le profil de l'utilisateur connecté : nom, bio, avatar (§Lot 5). */
export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = ((formData.get("displayName") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();

  if (!displayName) return { error: "displayNameRequired" };
  if (displayName.length > NAME_MAX) {
    return { error: "nameTooLong", errorParams: { n: NAME_MAX } };
  }
  if (bio.length > BIO_MAX) {
    return { error: "bioTooLong", errorParams: { n: BIO_MAX } };
  }

  // Avatar (optionnel) : validé + re-encodé + EXIF purgé, stocké sur le bucket
  // S3 (cahier médias). Validation AVANT toute écriture.
  const file = formData.get("avatar");
  let newAvatarMediaId: string | null = null;
  if (file instanceof File && file.size > 0) {
    const result = await processUpload(file);
    if (!result.ok) return { error: result.error };
    if (result.kind !== "image") {
      return { error: "avatarMustBeImage" };
    }
    const row = await persistMedia({ ownerUserId: user.id, processed: result });
    newAvatarMediaId = row.id;
  }

  await db
    .update(users)
    .set({
      displayName,
      bio,
      ...(newAvatarMediaId
        ? { avatarMediaId: newAvatarMediaId, avatarUpdatedAt: new Date() }
        : {}),
    })
    .where(eq(users.id, user.id));

  // Nettoyage best-effort de l'ancien avatar S3 (remplacement).
  if (newAvatarMediaId && user.avatarMediaId) {
    try {
      const old = await db.query.media.findFirst({
        where: eq(media.id, user.avatarMediaId),
        columns: { storageKey: true, thumbnailKey: true },
      });
      await db.delete(media).where(eq(media.id, user.avatarMediaId));
      if (old?.storageKey) await deleteObject(old.storageKey);
      if (old?.thumbnailKey) await deleteObject(old.thumbnailKey);
    } catch (err) {
      console.error("[media] échec du nettoyage de l'ancien avatar :", err);
    }
  }

  revalidatePath(`/@${user.handle}`);
  revalidatePath("/");
  return { success: "profileUpdated" };
}

/**
 * Retire un flux des « flux déclarés » de l'utilisateur (§Lot 5), sans détruire
 * les données globales : un flux réclamé redevient orphelin ; un flux seulement
 * référencé est détaché. On retire aussi l'abonnement de l'utilisateur.
 */
export async function removeOwnFeedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const feedId = (formData.get("feedId") as string) ?? "";
  if (!feedId) return;

  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true, ownerId: true, referencedBy: true },
  });
  if (!feed) return;

  if (feed.ownerId === user.id) {
    await db
      .update(feeds)
      .set({
        ownerId: null,
        ownershipStatus: "orphan",
        fullTextAllowed: false,
      })
      .where(eq(feeds.id, feedId));
  } else if (feed.referencedBy === user.id) {
    await db
      .update(feeds)
      .set({ referencedBy: null })
      .where(eq(feeds.id, feedId));
  } else {
    return; // pas un flux de cet utilisateur.
  }

  await db
    .delete(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, user.id),
        eq(feedSubscriptions.feedId, feedId),
      ),
    );

  revalidatePath(`/@${user.handle}`);
}
