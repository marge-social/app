"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feedSubscriptions, feeds, userAvatars, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

const NAME_MAX = 80;
const BIO_MAX = 500;
const AVATAR_MAX_BYTES = 1_000_000; // 1 Mo
const AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Met à jour le profil de l'utilisateur connecté : nom, bio, avatar (§Lot 5). */
export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = ((formData.get("displayName") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();

  if (!displayName) return { error: "Le nom affiché est requis." };
  if (displayName.length > NAME_MAX) {
    return { error: `Nom trop long (max ${NAME_MAX} caractères).` };
  }
  if (bio.length > BIO_MAX) {
    return { error: `Bio trop longue (max ${BIO_MAX} caractères).` };
  }

  // Avatar (optionnel).
  const file = formData.get("avatar");
  let avatarUploaded = false;
  if (file instanceof File && file.size > 0) {
    if (!AVATAR_TYPES.has(file.type)) {
      return { error: "Format d’image non supporté (JPEG, PNG, WebP, GIF)." };
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return { error: "Image trop lourde (max 1 Mo)." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await db
      .insert(userAvatars)
      .values({ userId: user.id, data: buffer, contentType: file.type })
      .onConflictDoUpdate({
        target: userAvatars.userId,
        set: { data: buffer, contentType: file.type, updatedAt: new Date() },
      });
    avatarUploaded = true;
  }

  await db
    .update(users)
    .set({
      displayName,
      bio,
      ...(avatarUploaded ? { avatarUpdatedAt: new Date() } : {}),
    })
    .where(eq(users.id, user.id));

  revalidatePath(`/@${user.handle}`);
  revalidatePath("/");
  return { success: "Profil mis à jour." };
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
