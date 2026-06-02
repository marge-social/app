import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { users } from "../src/db/schema";
import { hash, verify } from "@node-rs/argon2";
import { generateActorKeys, decryptSecret } from "../src/lib/crypto";

// auth.ts importe `server-only`/`next/headers`, non résolvables hors Next ;
// on teste donc le hachage directement et le cycle de session via le navigateur.
const hashPassword = (p: string) => hash(p, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
const verifyPassword = (h: string, p: string) => verify(h, p);

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  const handle = "smoketest";
  // Nettoyage idempotent.
  await db.delete(users).where(eq(users.handle, handle));

  console.log("1) Génération de clés d'acteur");
  const keys = await generateActorKeys();
  assert(Array.isArray(keys.publicKeys) && keys.publicKeys.length === 2, "2 clés publiques (RSA + Ed25519)");
  const decrypted = JSON.parse(decryptSecret(keys.privateKeysEncrypted));
  assert(Array.isArray(decrypted) && decrypted.length === 2, "clés privées déchiffrables (round-trip AES-GCM)");
  assert(keys.publicKeys.some((k) => k.kty === "RSA"), "présence d'une clé RSA (compat Mastodon)");

  console.log("2) Hachage de mot de passe (argon2id)");
  const ph = await hashPassword("correct horse battery");
  assert(await verifyPassword(ph, "correct horse battery"), "mot de passe correct vérifié");
  assert(!(await verifyPassword(ph, "wrong")), "mot de passe incorrect rejeté");

  console.log("3) Persistance d'un compte");
  const [u] = await db
    .insert(users)
    .values({
      email: "smoke@example.test",
      passwordHash: ph,
      handle,
      displayName: "Smoke Test",
      publicKeys: keys.publicKeys,
      privateKeys: keys.privateKeysEncrypted,
    })
    .returning({ id: users.id });
  assert(!!u.id, "compte inséré, id=" + u.id);

  console.log("4) Nettoyage");
  await db.delete(users).where(eq(users.id, u.id));
  assert(!(await db.query.users.findFirst({ where: eq(users.id, u.id) })), "compte supprimé");

  console.log("\nTOUS LES TESTS S0 PASSENT ✅");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
