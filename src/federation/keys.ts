import { importJwk } from "@fedify/fedify";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

/**
 * Charge les paires de clés cryptographiques d'un acteur local (par handle),
 * en déchiffrant les JWK privés stockés. Renvoie [] si le compte ou les clés
 * sont absents. L'ordre est conservé : [RSA, Ed25519].
 */
export async function loadActorKeyPairs(
  handle: string,
): Promise<CryptoKeyPair[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.handle, handle),
    columns: { publicKeys: true, privateKeys: true },
  });
  if (!user?.publicKeys || !user.privateKeys) return [];

  const publicJwks = user.publicKeys as JsonWebKey[];
  const privateJwks = JSON.parse(decryptSecret(user.privateKeys)) as JsonWebKey[];

  const pairs: CryptoKeyPair[] = [];
  for (let i = 0; i < publicJwks.length; i++) {
    const privateJwk = privateJwks[i];
    if (!privateJwk) continue;
    pairs.push({
      publicKey: await importJwk(publicJwks[i], "public"),
      privateKey: await importJwk(privateJwk, "private"),
    });
  }
  return pairs;
}
