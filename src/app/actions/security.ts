"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getCurrentUser,
  getSessionToken,
  hashPassword,
  invalidateOtherSessions,
  verifyPassword,
} from "@/lib/auth";

export interface PasswordFormState {
  /** Clés i18n (dict.errors / dict.success), traduites au rendu. */
  error?: string;
  errorParams?: Record<string, string | number>;
  success?: string;
}

const MIN_LEN = 8;

/**
 * Change le mot de passe après vérification de l'actuel (§4.2). Réutilise le
 * hachage argon2id existant. Invalide les autres sessions, en gardant la
 * courante. Aucune règle de composition absurde (anti-dark-pattern), juste une
 * longueur minimale.
 */
export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const current = (formData.get("current") as string) ?? "";
  const next = (formData.get("next") as string) ?? "";
  const confirm = (formData.get("confirm") as string) ?? "";

  if (!current || !next || !confirm) {
    return { error: "allFieldsRequired" };
  }
  if (next.length < MIN_LEN) {
    return { error: "passwordTooShortN", errorParams: { n: MIN_LEN } };
  }
  if (next !== confirm) {
    return { error: "confirmMismatch" };
  }

  const ok = await verifyPassword(user.passwordHash, current);
  if (!ok) return { error: "currentPasswordWrong" };
  if (next === current) {
    return { error: "newMustDiffer" };
  }

  const passwordHash = await hashPassword(next);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  const token = await getSessionToken();
  if (token) await invalidateOtherSessions(user.id, token);

  return { success: "passwordChanged" };
}
