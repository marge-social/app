"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Marque toutes les notifications non lues de l'utilisateur comme lues (§2.6). */
export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, user.id),
        isNull(notifications.readAt),
      ),
    );

  revalidatePath("/notifications");
}

/**
 * Rafraîchissement manuel de la liste (§2.6) : pas de polling ni de temps réel
 * en V1, on relit simplement la liste au prochain rendu.
 */
export async function refreshNotificationsAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  revalidatePath("/notifications");
}
