"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { actorUri } from "@/lib/config";
import {
  followRemoteActor,
  unfollowRemoteActor,
} from "@/federation/follow";

/** Suit un compte LOCAL (Marge↔Marge) : relation interne, acceptée d'emblée. */
export async function followLocalAction(formData: FormData): Promise<void> {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  const targetId = formData.get("targetUserId") as string;
  if (!targetId || targetId === viewer.id) return;

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { id: true, handle: true },
  });
  if (!target) return;

  await db
    .insert(follows)
    .values({
      followerUri: actorUri(viewer.handle),
      followingUri: actorUri(target.handle),
      followerUserId: viewer.id,
      followingUserId: target.id,
      status: "accepted",
    })
    .onConflictDoNothing();

  revalidatePath(`/@${target.handle}`);
  revalidatePath("/feed");
}

/** Cesse de suivre un compte local. */
export async function unfollowLocalAction(formData: FormData): Promise<void> {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  const targetId = formData.get("targetUserId") as string;
  if (!targetId) return;

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { id: true, handle: true },
  });
  if (!target) return;

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerUserId, viewer.id),
        eq(follows.followingUserId, target.id),
      ),
    );

  revalidatePath(`/@${target.handle}`);
  revalidatePath("/feed");
}

export interface RemoteFollowState {
  error?: string;
  success?: string;
}

/** Suit un compte distant (Fediverse) par handle. */
export async function followRemoteAction(
  _prev: RemoteFollowState,
  formData: FormData,
): Promise<RemoteFollowState> {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  const handle = ((formData.get("handle") as string) ?? "").trim();
  if (!handle) return { error: "Indique un handle (@compte@instance)." };

  const result = await followRemoteActor(viewer.handle, viewer.id, handle);
  if (!result.ok) return { error: result.error ?? "Échec du suivi." };

  revalidatePath("/feed");
  return { success: `Demande de suivi envoyée à ${handle}.` };
}

/** Cesse de suivre un compte distant. */
export async function unfollowRemoteAction(formData: FormData): Promise<void> {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  const remoteUri = formData.get("remoteUri") as string;
  if (!remoteUri) return;
  await unfollowRemoteActor(viewer.handle, remoteUri);
  revalidatePath("/feed");
}
