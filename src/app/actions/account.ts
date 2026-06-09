"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSessionCookie, getCurrentUser, logout } from "@/lib/auth";
import { deliverActorDelete } from "@/federation/delivery";

/**
 * Suppression de compte effective (RGPD). Émet d'abord un `Delete(Person)`
 * fédéré (livraison immédiate, avant que les clés ne disparaissent), puis
 * supprime l'utilisateur — les données liées tombent en cascade (sessions,
 * articles, follows, abonnements, réclamations ; les flux possédés
 * redeviennent orphelins).
 */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (formData.get("confirm") !== "on") redirect("/preferences");

  await deliverActorDelete(user.handle);
  await logout();
  await db.delete(users).where(eq(users.id, user.id));
  await clearSessionCookie();
  redirect("/");
}
