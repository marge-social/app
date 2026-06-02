import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { exportJwk, generateCryptoKeyPair } from "@fedify/fedify";

/**
 * Clé AES-256 dérivée du secret d'environnement (SHA-256 → 32 octets), pour
 * pouvoir accepter n'importe quelle longueur de secret en entrée.
 */
function encryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("KEY_ENCRYPTION_SECRET is not set");
  return createHash("sha256").update(secret).digest();
}

/** Chiffre une chaîne (AES-256-GCM). Renvoie `iv:tag:ciphertext` en base64. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(":");
}

/** Déchiffre une chaîne produite par `encryptSecret`. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export interface ActorKeyMaterial {
  /** JWK publics en clair (stockés dans users.publicKeys). */
  publicKeys: JsonWebKey[];
  /** JSON des JWK privés, chiffré (stocké dans users.privateKeys). */
  privateKeysEncrypted: string;
}

/**
 * Génère les paires de clés d'un acteur ActivityPub : RSASSA-PKCS1-v1_5 (requis
 * par Mastodon pour les signatures HTTP) + Ed25519 (signatures objet modernes).
 * Les JWK privés sont chiffrés avant stockage (cf. risque « sécurité des clés »).
 */
export async function generateActorKeys(): Promise<ActorKeyMaterial> {
  const algorithms = ["RSASSA-PKCS1-v1_5", "Ed25519"] as const;
  const pairs = await Promise.all(
    algorithms.map((algo) => generateCryptoKeyPair(algo)),
  );

  const publicKeys: JsonWebKey[] = [];
  const privateKeys: JsonWebKey[] = [];
  for (const pair of pairs) {
    publicKeys.push(await exportJwk(pair.publicKey));
    privateKeys.push(await exportJwk(pair.privateKey));
  }

  return {
    publicKeys,
    privateKeysEncrypted: encryptSecret(JSON.stringify(privateKeys)),
  };
}
