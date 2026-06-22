"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { pendingSignups, users } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth";
import { generateActorKeys } from "@/lib/crypto";
import { isReservedHandle } from "@/lib/handles";
import {
  type NotifyChoice,
  applyOnboardingExtras,
  parseSources,
} from "@/lib/onboarding-finalize";
import { findPendingByToken } from "@/lib/signups";
import { handleSchema, onboardingSchema } from "@/lib/validation";

export interface OnboardingState {
  error?: string;
}

export type HandleAvailability =
  | "empty"
  | "invalid"
  | "reserved"
  | "taken"
  | "available";

/**
 * Disponibilité d'un handle, pour le retour en direct à l'onboarding. N'expose
 * que l'état (jamais de détail) et ne réserve rien : la prise effective se joue
 * à la finalisation, sous la contrainte d'unicité.
 */
export async function checkHandleAvailabilityAction(
  handle: string,
): Promise<HandleAvailability> {
  const raw = handle.trim();
  if (!raw) return "empty";
  const parsed = handleSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  if (isReservedHandle(parsed.data)) return "reserved";
  const taken = await db.query.users.findFirst({
    where: eq(users.handle, parsed.data),
  });
  return taken ? "taken" : "available";
}

/**
 * Finalisation de l'onboarding (cf. ADR 0006). Reçoit le **jeton** d'activation
 * (le flux n'a pas encore de session) + le profil choisi, crée la ligne `users`
 * complète (handle + clés ActivityPub), supprime l'inscription en attente puis
 * ouvre la session. C'est le seul point où un compte « réel » naît.
 */
export async function finishOnboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const token = String(formData.get("token") ?? "");
  const pending = await findPendingByToken(token);
  if (!pending) return { error: "activationInvalid" };

  const parsed = onboardingSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalidData" };
  }
  const { handle, displayName, bio } = parsed.data;

  if (isReservedHandle(handle)) return { error: "handleReserved" };

  // Garde-fou applicatif ; la contrainte d'unicité tranche en cas de course.
  const handleTaken = await db.query.users.findFirst({
    where: eq(users.handle, handle),
  });
  if (handleTaken) return { error: "handleTaken" };

  // L'email a pu être pris entre-temps par une autre finalisation.
  const emailTaken = await db.query.users.findFirst({
    where: eq(users.email, pending.email),
  });
  if (emailTaken) {
    await db.delete(pendingSignups).where(eq(pendingSignups.id, pending.id));
    return { error: "emailExists" };
  }

  const keys = await generateActorKeys();

  let userId: string;
  try {
    const [user] = await db
      .insert(users)
      .values({
        email: pending.email,
        passwordHash: pending.passwordHash,
        handle,
        displayName,
        bio,
        locale: pending.locale,
        publicKeys: keys.publicKeys,
        privateKeys: keys.privateKeysEncrypted,
      })
      .returning({ id: users.id });
    userId = user.id;
  } catch {
    // Violation d'unicité (handle/email) gagnée par une course concurrente.
    return { error: "handleTaken" };
  }

  // Le compte est créé : on retire l'inscription en attente.
  await db.delete(pendingSignups).where(eq(pendingSignups.id, pending.id));

  // Choix de l'onboarding (avatar, abonnements, notifications, présentation) :
  // best-effort, n'empêche jamais l'entrée dans marge en cas d'échec partiel.
  const avatar = formData.get("avatar");
  const notifyRaw = String(formData.get("notify") ?? "résumé");
  const notify: NotifyChoice =
    notifyRaw === "direct" || notifyRaw === "aucune" ? notifyRaw : "résumé";
  try {
    await applyOnboardingExtras(
      { id: userId, handle, displayName },
      {
        sources: parseSources(formData.get("sources") as string | null),
        notify,
        intro: String(formData.get("intro") ?? ""),
        avatar: avatar instanceof File && avatar.size > 0 ? avatar : null,
      },
    );
  } catch (err) {
    console.error("[onboarding] extras:", (err as Error).message);
  }

  const sessionToken = await createSession(userId);
  await setSessionCookie(sessionToken);
  redirect("/");
}
