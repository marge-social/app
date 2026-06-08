"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notificationSettings, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  INTERACTION_NOTIF_TYPES,
  type NotifChannel,
  type NotifScope,
} from "@/lib/notifications";

const CHANNELS: NotifChannel[] = ["realtime", "digest", "off"];
const SCOPES: NotifScope[] = ["all", "local", "federated"];

/**
 * Enregistre la matrice de préférences de notification (§4.2) : pour chacun des
 * 4 types, un canal et une portée. On persiste les 4 lignes en dérogation ; les
 * valeurs absentes/invalides retombent sur le défaut §4.3 à la lecture.
 */
export async function saveNotificationSettingsAction(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  for (const type of INTERACTION_NOTIF_TYPES) {
    const channel = formData.get(`channel_${type}`) as NotifChannel | null;
    const scope = formData.get(`scope_${type}`) as NotifScope | null;
    if (!channel || !CHANNELS.includes(channel)) continue;
    if (!scope || !SCOPES.includes(scope)) continue;
    await db
      .insert(notificationSettings)
      .values({ userId: user.id, type, channel, scope })
      .onConflictDoUpdate({
        target: [notificationSettings.userId, notificationSettings.type],
        set: { channel, scope },
      });
  }

  revalidatePath("/preferences");
}

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
