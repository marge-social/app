import "server-only";

import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { pendingSignups } from "@/db/schema";
import { APP_URL } from "@/lib/config";
import { sendActivationEmail, sendReminderEmail } from "@/lib/mail";
import { generateToken, hashToken } from "@/lib/tokens";

/**
 * Inscriptions en attente d'activation (cf. ADR 0006). Centralise la création,
 * la résolution par jeton et la maintenance (rappel 48 h / suppression 96 h).
 */

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_AFTER_MS = 48 * HOUR_MS;
const DELETE_AFTER_MS = 96 * HOUR_MS;

export type PendingSignup = typeof pendingSignups.$inferSelect;

/** Lien d'activation (entrée de l'onboarding) à partir du jeton brut. */
export function activationUrl(token: string): string {
  return `${APP_URL}/bienvenue?token=${encodeURIComponent(token)}`;
}

/**
 * Crée — ou rafraîchit si une inscription en attente existe déjà pour cet email
 * — une inscription en attente, puis envoie l'email d'activation. Un nouveau
 * jeton est émis à chaque fois (le précédent, jamais utilisé, est invalidé) et
 * l'horloge des 96 h est remise à zéro.
 */
export async function createPendingSignup(
  email: string,
  passwordHash: string,
  locale: string,
): Promise<void> {
  const token = generateToken();
  const tokenHash = hashToken(token);

  await db
    .insert(pendingSignups)
    .values({ email, passwordHash, tokenHash, locale })
    .onConflictDoUpdate({
      target: pendingSignups.email,
      set: {
        passwordHash,
        tokenHash,
        locale,
        verifiedAt: null,
        reminderSentAt: null,
        createdAt: new Date(),
      },
    });

  await sendActivationEmail(email, activationUrl(token), locale);
}

/** Résout une inscription en attente à partir de l'email (ou null). */
export async function findPendingByEmail(
  email: string,
): Promise<PendingSignup | null> {
  const row = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.email, email),
  });
  return row ?? null;
}

/**
 * Renvoie un email d'activation pour une inscription en attente (ex. : tentative
 * de connexion sur un compte jamais activé). Fait tourner le jeton — on ne
 * stocke que son hash, le précédent (toujours valable) est invalidé — et remet à
 * zéro l'horloge des rappels.
 */
export async function resendActivation(
  id: string,
  email: string,
  locale: string,
): Promise<void> {
  const token = generateToken();
  await db
    .update(pendingSignups)
    .set({ tokenHash: hashToken(token), reminderSentAt: null })
    .where(eq(pendingSignups.id, id));
  await sendActivationEmail(email, activationUrl(token), locale);
}

/** Résout une inscription en attente à partir du jeton brut (ou null). */
export async function findPendingByToken(
  token: string,
): Promise<PendingSignup | null> {
  if (!token) return null;
  const row = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.tokenHash, hashToken(token)),
  });
  return row ?? null;
}

/** Marque l'inscription comme vérifiée (premier clic sur le lien d'activation). */
export async function markPendingVerified(id: string): Promise<void> {
  await db
    .update(pendingSignups)
    .set({ verifiedAt: new Date() })
    .where(and(eq(pendingSignups.id, id), isNull(pendingSignups.verifiedAt)));
}

export interface SignupMaintenanceResult {
  reminded: number;
  deleted: number;
}

/**
 * Maintenance des inscriptions non activées (déclenchée par le cron) :
 * 1. supprime celles qui n'ont jamais été activées au-delà de 96 h ;
 * 2. envoie un rappel à celles bloquées depuis ≥ 48 h sans rappel déjà émis.
 *
 * Le rappel **fait tourner un nouveau jeton** : on ne stocke que le hash, donc
 * on ne peut pas reconstruire le lien d'origine — on en émet un neuf.
 */
export async function runSignupMaintenance(): Promise<SignupMaintenanceResult> {
  const now = Date.now();
  const deleteCutoff = new Date(now - DELETE_AFTER_MS);
  const reminderCutoff = new Date(now - REMINDER_AFTER_MS);

  // 1. Suppression des inscriptions jamais activées au-delà de 96 h.
  const deleted = await db
    .delete(pendingSignups)
    .where(
      and(
        isNull(pendingSignups.verifiedAt),
        lt(pendingSignups.createdAt, deleteCutoff),
      ),
    )
    .returning({ id: pendingSignups.id });

  // 2. Rappel pour les inscriptions bloquées entre 48 h et 96 h, sans rappel.
  const due = await db.query.pendingSignups.findMany({
    where: and(
      isNull(pendingSignups.verifiedAt),
      isNull(pendingSignups.reminderSentAt),
      lt(pendingSignups.createdAt, reminderCutoff),
    ),
  });

  let reminded = 0;
  for (const row of due) {
    const token = generateToken();
    await db
      .update(pendingSignups)
      .set({ tokenHash: hashToken(token), reminderSentAt: new Date() })
      .where(eq(pendingSignups.id, row.id));
    try {
      await sendReminderEmail(row.email, activationUrl(token), row.locale);
      reminded += 1;
    } catch (err) {
      console.error("[signups] rappel non envoyé:", (err as Error).message);
    }
  }

  return { reminded, deleted: deleted.length };
}
