import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";

/**
 * Jetons opaques (sessions + liens email). Helpers purs — sans `next/headers`
 * ni cookies — pour rester importables hors contexte Next (tests fumée).
 */

/** Jeton opaque imprévisible (20 octets, base32). */
export function generateToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

/** Hash SHA-256 d'un jeton — seul le hash est persisté, jamais le jeton brut. */
export function hashToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}
