import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/**
 * Infos d'affichage de l'acteur déclencheur, mises en cache au moment de
 * l'événement (§2.4) pour ne pas refaire de requête réseau à chaque rendu.
 */
export interface NotificationActor {
  uri: string;
  handle: string;
  name?: string | null;
  iconUrl?: string | null;
}

/**
 * Crée une notification `follow` pour un destinataire local, avec
 * déduplication (§2.5) : on n'empile pas de doublon si une notification
 * `follow` **non lue** du même acteur vers le même destinataire existe déjà.
 *
 * Un unfollow puis refollow re-notifie légitimement : soit la précédente a été
 * lue (la garde ne s'applique plus), soit elle est encore non lue (l'utilisateur
 * n'a de toute façon pas encore « accusé réception », un seul item suffit).
 */
export async function createFollowNotification(
  recipientUserId: string,
  actor: NotificationActor,
): Promise<void> {
  const existing = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.recipientUserId, recipientUserId),
      eq(notifications.type, "follow"),
      eq(notifications.actorUri, actor.uri),
      isNull(notifications.readAt),
    ),
    columns: { id: true },
  });
  if (existing) return;

  await db.insert(notifications).values({
    recipientUserId,
    type: "follow",
    actorUri: actor.uri,
    actorHandle: actor.handle,
    actorName: actor.name ?? null,
    actorIconUrl: actor.iconUrl ?? null,
    // objectUri reste null pour un follow.
  });
}

/** Nombre de notifications non lues d'un destinataire (badge de navigation). */
export async function countUnreadNotifications(
  recipientUserId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, recipientUserId),
        isNull(notifications.readAt),
      ),
    );
  return row?.value ?? 0;
}
