import "dotenv/config";
import { eq, like } from "drizzle-orm";
import { db } from "../src/db";
import { pendingSignups, users } from "../src/db/schema";
import {
  createPendingSignup,
  findPendingByToken,
  markPendingVerified,
  runSignupMaintenance,
} from "../src/lib/signups";
import { generateToken, hashToken } from "../src/lib/tokens";

// Test fumée du mécanisme d'inscription en deux temps (cf. ADR 0006).
// Exécuter : npx tsx --conditions=react-server scripts/smoke-signup.ts
const TAG = "smoke-signup";
const H = 3_600_000;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function cleanup() {
  await db.delete(pendingSignups).where(like(pendingSignups.email, `${TAG}+%`));
  await db.delete(users).where(like(users.email, `${TAG}+%`));
}

async function main() {
  await cleanup();

  // 1. Inscription en attente (transport mail « journal » → lien en console).
  const email1 = `${TAG}+create@example.test`;
  await createPendingSignup(email1, "argon2-placeholder", "fr");
  const row1 = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.email, email1),
  });
  assert(row1, "createPendingSignup insère une inscription en attente");
  assert(row1.verifiedAt === null, "une inscription neuve est non vérifiée");

  // 2. Résolution par jeton (insert direct avec un jeton brut connu).
  const email2 = `${TAG}+token@example.test`;
  const token2 = generateToken();
  await db.insert(pendingSignups).values({
    email: email2,
    passwordHash: "h",
    tokenHash: hashToken(token2),
    locale: "fr",
  });
  const found = await findPendingByToken(token2);
  assert(found?.email === email2, "findPendingByToken résout le jeton brut");
  assert(
    (await findPendingByToken("jeton-inconnu")) === null,
    "jeton inconnu → null",
  );

  // 3. Vérification (premier clic).
  await markPendingVerified(found.id);
  const verified = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.id, found.id),
  });
  assert(verified?.verifiedAt instanceof Date, "markPendingVerified pose verifiedAt");

  // 4. Maintenance : rappel à 48 h, suppression à 96 h, vérifié intact.
  const now = Date.now();
  const mk = async (suffix: string, ageH: number, verified: boolean) => {
    const tok = generateToken();
    const [r] = await db
      .insert(pendingSignups)
      .values({
        email: `${TAG}+${suffix}@example.test`,
        passwordHash: "h",
        tokenHash: hashToken(tok),
        locale: "fr",
        createdAt: new Date(now - ageH * H),
        verifiedAt: verified ? new Date() : null,
      })
      .returning({ id: pendingSignups.id });
    return { id: r.id, tokenHash: hashToken(tok) };
  };
  const a = await mk("old", 100, false); // > 96 h non vérifié → supprimé
  const b = await mk("rem", 50, false); // 48–96 h non vérifié → rappelé
  const c = await mk("ver", 50, true); // vérifié → intact

  await runSignupMaintenance();

  const aGone = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.id, a.id),
  });
  assert(!aGone, "maintenance supprime un non-vérifié de plus de 96 h");

  const bRow = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.id, b.id),
  });
  assert(bRow?.reminderSentAt instanceof Date, "maintenance rappelle à 48–96 h");
  assert(bRow.tokenHash !== b.tokenHash, "le rappel fait tourner le jeton");

  const cRow = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.id, c.id),
  });
  assert(cRow?.reminderSentAt === null, "une inscription vérifiée reste intacte");

  // 5. Idempotence : pas de second rappel.
  const before = bRow.reminderSentAt?.getTime();
  await runSignupMaintenance();
  const bRow2 = await db.query.pendingSignups.findFirst({
    where: eq(pendingSignups.id, b.id),
  });
  assert(
    bRow2?.reminderSentAt?.getTime() === before,
    "maintenance idempotente (pas de double rappel)",
  );

  await cleanup();
  console.log("\nTous les tests smoke-signup passent.");
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  process.exit(1);
});
