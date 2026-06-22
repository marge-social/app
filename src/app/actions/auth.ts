"use server";

import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  logout as logoutSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getServerI18n } from "@/lib/i18n/server";
import {
  createPendingSignup,
  findPendingByEmail,
  resendActivation,
} from "@/lib/signups";
import { loginSchema, signupSchema } from "@/lib/validation";

export interface AuthState {
  error?: string;
  /** Vrai quand l'email d'activation vient (potentiellement) d'être envoyé. */
  ok?: boolean;
  /**
   * Vrai quand la connexion visait un compte **jamais activé** (inscription en
   * attente, mot de passe correct) : on vient de renvoyer l'email d'activation.
   */
  pendingActivation?: boolean;
}

/**
 * Inscription (étape 1, cf. ADR 0006) : on ne demande qu'email + mot de passe.
 * Aucun compte n'est créé ici — une **inscription en attente** est posée et un
 * email d'activation est envoyé. Le handle et le profil sont choisis ensuite à
 * l'onboarding.
 *
 * Réponse **neutre** (toujours `ok:true` pour une saisie valide) : on ne révèle
 * pas si l'email est déjà rattaché à un compte (anti-énumération, cohérent avec
 * le message générique de la connexion).
 */
export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    // Les messages Zod portent des clés i18n (cf. validation.ts).
    return { error: parsed.error.issues[0]?.message ?? "invalidData" };
  }
  const { email, password } = parsed.data;

  // Si un compte complet existe déjà, on s'arrête en silence (pas d'énumération).
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return { ok: true };

  const passwordHash = await hashPassword(password);
  const { locale } = await getServerI18n();
  await createPendingSignup(email, passwordHash, locale);

  return { ok: true };
}

/**
 * Connexion par **email ou handle** (cf. portail « Email ou handle »). Message
 * d'erreur générique pour ne pas révéler l'existence d'un compte.
 */
export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier") ?? formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalidData" };
  }
  const { identifier, password } = parsed.data;
  // L'identifiant peut être un email (contient @) ou un handle (avec/sans @).
  const asEmail = identifier.toLowerCase();
  const asHandle = identifier.replace(/^@/, "").toLowerCase();

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, asEmail), eq(users.handle, asHandle)),
  });
  const invalid = { error: "invalidCredentials" };
  if (!user) {
    // Pas de compte activé pour cet identifiant. Peut-être une inscription en
    // attente d'activation (cf. ADR 0006) ? On ne le révèle qu'après avoir
    // vérifié le mot de passe — sinon on ouvrirait un oracle d'énumération.
    const pending = await findPendingByEmail(asEmail);
    if (pending) {
      if (await verifyPassword(pending.passwordHash, password)) {
        await resendActivation(pending.id, pending.email, pending.locale);
        return { pendingActivation: true };
      }
      // Mauvais mot de passe : verifyPassword a déjà payé le coût de timing.
      return invalid;
    }
    // Aucune inscription : on hache quand même pour limiter l'oracle de timing.
    await hashPassword(password);
    return invalid;
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return invalid;

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await logoutSession();
  await clearSessionCookie();
  redirect("/");
}
