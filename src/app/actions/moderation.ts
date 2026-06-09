"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { actorBlocks, follows } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/**
 * Modération minimale (F7) : bloque un acteur distant. Rompt le suivi éventuel
 * et exclut son contenu du fil. Blocage interne (pas d'activité Block fédérée
 * au MVP).
 */
export async function blockActorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const actorUri = formData.get("actorUri") as string;
  if (!actorUri) return;

  await db
    .insert(actorBlocks)
    .values({ userId: user.id, actorUri })
    .onConflictDoNothing();
  // Rompt le suivi si présent.
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerUserId, user.id),
        eq(follows.followingUri, actorUri),
      ),
    );
  revalidatePath("/");
}

/** Lève le blocage d'un acteur distant. */
export async function unblockActorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const actorUri = formData.get("actorUri") as string;
  if (!actorUri) return;
  await db
    .delete(actorBlocks)
    .where(
      and(eq(actorBlocks.userId, user.id), eq(actorBlocks.actorUri, actorUri)),
    );
  revalidatePath("/");
}
