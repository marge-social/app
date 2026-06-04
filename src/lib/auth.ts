import "server-only";
import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "marge_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours
const SESSION_REFRESH_MS = 1000 * 60 * 60 * 24 * 15; // prolonge à mi-vie

// --- Mots de passe -------------------------------------------------------

export function hashPassword(password: string): Promise<string> {
  // Paramètres argon2id recommandés par OWASP.
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

// --- Sessions ------------------------------------------------------------

function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

function sessionIdFromToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

/** Crée une session en base et renvoie le token brut (à poser en cookie). */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const id = sessionIdFromToken(token);
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

type SessionUser = typeof users.$inferSelect;

/** Valide un token : renvoie l'utilisateur ou null, avec expiration glissante. */
export async function validateSessionToken(
  token: string,
): Promise<SessionUser | null> {
  const id = sessionIdFromToken(token);
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });
  if (!row) return null;

  if (Date.now() >= row.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // Prolongation glissante quand on approche de la mi-vie.
  if (Date.now() >= row.expiresAt.getTime() - SESSION_REFRESH_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
  });
  return user ?? null;
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionIdFromToken(token)));
}

/**
 * Invalide toutes les sessions de l'utilisateur SAUF la session courante
 * (après changement de mot de passe). Le token courant est préservé pour ne
 * pas déconnecter l'utilisateur qui vient d'agir.
 */
export async function invalidateOtherSessions(
  userId: string,
  currentToken: string,
): Promise<void> {
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, sessionIdFromToken(currentToken)),
      ),
    );
}

// --- Intégration cookies Next.js -----------------------------------------

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Utilisateur courant à partir du cookie de session (ou null). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/** Token de session brut du cookie courant (ou null). */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Déconnecte : invalide la session et efface le cookie. */
export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  store.delete(SESSION_COOKIE);
}
