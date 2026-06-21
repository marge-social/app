/**
 * Handles réservés : ils entreraient en collision avec une route de
 * l'application ou une convention ActivityPub. Le handle est choisi à
 * l'onboarding (cf. ADR 0006) ; cette liste y est vérifiée.
 */
export const RESERVED_HANDLES = new Set([
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
  "bienvenue",
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}
