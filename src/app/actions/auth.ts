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
import { generateActorKeys } from "@/lib/crypto";
import { loginSchema, signupSchema } from "@/lib/validation";

export interface AuthState {
  error?: string;
}

/** Handles réservés (collisionnent avec des routes ou des conventions AP). */
const RESERVED_HANDLES = new Set([
  "users",
  "user",
  "settings",
  "feed",
  "feeds",
  "compose",
  "api",
  "login",
  "signup",
  "logout",
  "admin",
  "about",
  "inbox",
  "outbox",
  "well-known",
  "actor",
  "preferences",
  "recherche",
  "notes",
]);

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    // Les messages Zod portent des clés i18n (cf. validation.ts).
    return { error: parsed.error.issues[0]?.message ?? "invalidData" };
  }
  const { email, password, handle, displayName } = parsed.data;

  if (RESERVED_HANDLES.has(handle)) {
    return { error: "handleReserved" };
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, email), eq(users.handle, handle)),
  });
  if (existing) {
    return {
      error: existing.email === email ? "emailExists" : "handleTaken",
    };
  }

  // Génération de la paire de clés + projection acteur AP dès l'inscription.
  const keys = await generateActorKeys();
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      handle,
      displayName,
      publicKeys: keys.publicKeys,
      privateKeys: keys.privateKeysEncrypted,
    })
    .returning({ id: users.id });

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalidData" };
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  // Message générique pour ne pas révéler l'existence d'un compte.
  const invalid = { error: "invalidCredentials" };
  if (!user) {
    // Coût constant : on hache quand même pour limiter l'oracle de timing.
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
