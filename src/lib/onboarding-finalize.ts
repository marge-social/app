import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  feedSubscriptions,
  feeds,
  follows,
  notificationSettings,
  posts,
  users,
} from "@/db/schema";
import { isBlocked } from "@/lib/blocklist";
import { actorUri, fediverseHandle } from "@/lib/config";
import { renderMarkdown } from "@/lib/markdown";
import { persistMedia, processUpload } from "@/lib/media";
import {
  INTERACTION_NOTIF_TYPES,
  createFollowNotification,
} from "@/lib/notifications";
import { pollFeed } from "@/lib/poll";
import { discoverFeedUrl } from "@/lib/rss";
import { deliverCreateNote } from "@/federation/delivery";
import { followRemoteActor } from "@/federation/follow";
import type { OnboardingItemType } from "@/lib/onboarding-packs";

/**
 * Applique les choix d'onboarding **après** la création du compte (cf. ADR 0006).
 * Tout est **best-effort** : un échec (flux injoignable, compte distant
 * introuvable, S3…) est journalisé mais ne bloque jamais l'entrée dans marge.
 */

export interface OnboardingSource {
  type: OnboardingItemType;
  ref: string;
  label: string;
}

export type NotifyChoice = "résumé" | "direct" | "aucune";

interface FinalizeUser {
  id: string;
  handle: string;
  displayName: string;
}

/** Avatar : valide + ré-encode + purge EXIF + stocke (S3), puis rattache. */
async function applyAvatar(user: FinalizeUser, file: File): Promise<void> {
  const result = await processUpload(file);
  if (!result.ok || result.kind !== "image") return;
  const row = await persistMedia({ ownerUserId: user.id, processed: result });
  await db
    .update(users)
    .set({ avatarMediaId: row.id, avatarUpdatedAt: new Date() })
    .where(eq(users.id, user.id));
}

/** Préférence de notifications unique → réglages des 4 types interactifs. */
async function applyNotificationChoice(
  userId: string,
  choice: NotifyChoice,
): Promise<void> {
  const channel =
    choice === "direct" ? "realtime" : choice === "aucune" ? "off" : "digest";
  for (const type of INTERACTION_NOTIF_TYPES) {
    await db
      .insert(notificationSettings)
      .values({ userId, type, channel, scope: "all" })
      .onConflictDoUpdate({
        target: [notificationSettings.userId, notificationSettings.type],
        set: { channel, scope: "all" },
      });
  }
}

/** Suit un compte local marge à partir d'un handle/adresse. */
async function followLocal(user: FinalizeUser, ref: string): Promise<void> {
  const localHandle = ref.replace(/^@+/, "").split("@")[0].toLowerCase();
  if (!localHandle || localHandle === user.handle) return;
  const target = await db.query.users.findFirst({
    where: eq(users.handle, localHandle),
    columns: { id: true, handle: true },
  });
  if (!target) return;
  await db
    .insert(follows)
    .values({
      followerUri: actorUri(user.handle),
      followingUri: actorUri(target.handle),
      followerUserId: user.id,
      followingUserId: target.id,
      status: "accepted",
    })
    .onConflictDoNothing();
  await createFollowNotification(target.id, {
    uri: actorUri(user.handle),
    handle: fediverseHandle(user.handle),
    name: user.displayName,
  });
}

/** Référence (si besoin) un flux RSS/YouTube et y abonne l'utilisateur. */
async function subscribeFeed(userId: string, input: string): Promise<void> {
  const feedUrl = await discoverFeedUrl(input);
  if (await isBlocked(feedUrl)) return;
  let feedId: string;
  const existing = await db.query.feeds.findFirst({
    where: eq(feeds.feedUrl, feedUrl),
  });
  if (existing) {
    if (existing.ownershipStatus === "opt_out") return;
    feedId = existing.id;
  } else {
    const [created] = await db
      .insert(feeds)
      .values({ feedUrl, ownershipStatus: "orphan", referencedBy: userId })
      .returning();
    feedId = created.id;
    await pollFeed(created);
  }
  await db
    .insert(feedSubscriptions)
    .values({ userId, feedId })
    .onConflictDoNothing();
}

/** Publie la note de présentation (#introduction) + fédère aux abonnés. */
async function publishIntro(user: FinalizeUser, intro: string): Promise<void> {
  const body = /#introduction/i.test(intro) ? intro : `${intro}\n\n#introduction`;
  const contentHtml = renderMarkdown(body);
  const [post] = await db
    .insert(posts)
    .values({ authorId: user.id, contentMarkdown: body, contentHtml })
    .returning();
  await deliverCreateNote(user.handle, post);
}

export interface OnboardingExtras {
  sources: OnboardingSource[];
  notify: NotifyChoice;
  intro: string;
  avatar?: File | null;
}

/** Applique tous les extras d'onboarding, chacun isolé (best-effort). */
export async function applyOnboardingExtras(
  user: FinalizeUser,
  extras: OnboardingExtras,
): Promise<void> {
  if (extras.avatar) {
    try {
      await applyAvatar(user, extras.avatar);
    } catch (err) {
      console.error("[onboarding] avatar:", (err as Error).message);
    }
  }

  try {
    await applyNotificationChoice(user.id, extras.notify);
  } catch (err) {
    console.error("[onboarding] notifications:", (err as Error).message);
  }

  for (const src of extras.sources) {
    try {
      if (src.type === "marge") {
        await followLocal(user, src.ref);
      } else if (src.type === "fediverse") {
        await followRemoteActor(user.handle, user.id, src.ref);
      } else {
        await subscribeFeed(user.id, src.ref);
      }
    } catch (err) {
      console.error(`[onboarding] source ${src.ref}:`, (err as Error).message);
    }
  }

  const intro = extras.intro.trim();
  if (intro) {
    try {
      await publishIntro(user, intro);
    } catch (err) {
      console.error("[onboarding] intro:", (err as Error).message);
    }
  }
}

/** Parse + valide la liste de sources reçue du wizard (JSON). */
export function parseSources(raw: string | null): OnboardingSource[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const types: OnboardingItemType[] = ["marge", "fediverse", "rss", "youtube"];
  const out: OnboardingSource[] = [];
  for (const x of data) {
    if (!x || typeof x !== "object") continue;
    const t = (x as Record<string, unknown>).type;
    const ref = (x as Record<string, unknown>).ref;
    const label = (x as Record<string, unknown>).label;
    if (typeof t !== "string" || !types.includes(t as OnboardingItemType)) continue;
    if (typeof ref !== "string" || !ref.trim()) continue;
    out.push({
      type: t as OnboardingItemType,
      ref: ref.trim(),
      label: typeof label === "string" ? label : ref.trim(),
    });
    if (out.length >= 60) break; // garde-fou
  }
  return out;
}
