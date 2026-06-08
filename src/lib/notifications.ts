import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { digestItems, notificationSettings, notifications } from "@/db/schema";

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

// --- Matrice de préférences (§4.2) --------------------------------------

/** Les quatre types d'interaction réglables (le `follow` ne l'est pas). */
export type InteractionNotifType = "like" | "comment" | "reply" | "announce";
export type NotifChannel = "realtime" | "digest" | "off";
export type NotifScope = "all" | "local" | "federated";

export interface NotifSetting {
  channel: NotifChannel;
  scope: NotifScope;
}

/**
 * Valeurs par défaut « calm by default » (§4.3) : l'interaction coûteuse
 * interrompt (temps réel), le signal pauvre s'accumule en silence (digest).
 */
export const DEFAULT_NOTIF_SETTINGS: Record<InteractionNotifType, NotifSetting> =
  {
    reply: { channel: "realtime", scope: "all" },
    comment: { channel: "realtime", scope: "all" },
    announce: { channel: "digest", scope: "all" },
    like: { channel: "digest", scope: "all" },
  };

export const INTERACTION_NOTIF_TYPES: InteractionNotifType[] = [
  "reply",
  "comment",
  "announce",
  "like",
];

/**
 * Réglages effectifs d'un utilisateur : dérogations en base (le cas échéant)
 * superposées aux défauts §4.3. On ne persiste que ce qui diffère du défaut.
 */
export async function getEffectiveSettings(
  userId: string,
): Promise<Record<InteractionNotifType, NotifSetting>> {
  const rows = await db
    .select({
      type: notificationSettings.type,
      channel: notificationSettings.channel,
      scope: notificationSettings.scope,
    })
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId));

  const eff: Record<InteractionNotifType, NotifSetting> = {
    reply: { ...DEFAULT_NOTIF_SETTINGS.reply },
    comment: { ...DEFAULT_NOTIF_SETTINGS.comment },
    announce: { ...DEFAULT_NOTIF_SETTINGS.announce },
    like: { ...DEFAULT_NOTIF_SETTINGS.like },
  };
  for (const r of rows) {
    if (r.type in eff) {
      eff[r.type as InteractionNotifType] = {
        channel: r.channel,
        scope: r.scope,
      };
    }
  }
  return eff;
}

function scopeAllows(scope: NotifScope, origin: "local" | "federated"): boolean {
  return scope === "all" || scope === origin;
}

/**
 * **Routeur unique** de notification d'interaction (§4) : applique la portée
 * puis le canal du destinataire. `off` → rien ; `digest` → empilé en file
 * (regroupé plus tard) ; `realtime` → notification immédiate (dédupliquée pour
 * les bascules like/announce, jamais pour comment/reply qui sont distinctes).
 */
export async function routeInteractionNotification(params: {
  recipientUserId: string;
  type: InteractionNotifType;
  origin: "local" | "federated";
  actor: NotificationActor;
  objectUri: string | null;
}): Promise<void> {
  const setting = (await getEffectiveSettings(params.recipientUserId))[
    params.type
  ];
  if (!scopeAllows(setting.scope, params.origin)) return;
  if (setting.channel === "off") return;

  if (setting.channel === "digest") {
    await db.insert(digestItems).values({
      recipientUserId: params.recipientUserId,
      type: params.type,
      origin: params.origin,
      actorUri: params.actor.uri,
      actorHandle: params.actor.handle,
      actorName: params.actor.name ?? null,
      actorIconUrl: params.actor.iconUrl ?? null,
      objectUri: params.objectUri,
    });
    return;
  }

  // realtime : déduplication des bascules non lues (un like/partage = une notif).
  if (params.type === "like" || params.type === "announce") {
    const existing = await db.query.notifications.findFirst({
      where: and(
        eq(notifications.recipientUserId, params.recipientUserId),
        eq(notifications.type, params.type),
        eq(notifications.actorUri, params.actor.uri),
        params.objectUri
          ? eq(notifications.objectUri, params.objectUri)
          : isNull(notifications.objectUri),
        isNull(notifications.readAt),
      ),
      columns: { id: true },
    });
    if (existing) return;
  }

  await db.insert(notifications).values({
    recipientUserId: params.recipientUserId,
    type: params.type,
    actorUri: params.actor.uri,
    actorHandle: params.actor.handle,
    actorName: params.actor.name ?? null,
    actorIconUrl: params.actor.iconUrl ?? null,
    objectUri: params.objectUri,
  });
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
