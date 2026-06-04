import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { notifications, users } from "../src/db/schema";
import {
  createFollowNotification,
  countUnreadNotifications,
} from "../src/lib/notifications";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function countRows(recipientId: string): Promise<number> {
  const rows = await db.query.notifications.findMany({
    where: eq(notifications.recipientUserId, recipientId),
  });
  return rows.length;
}

async function main() {
  const handle = "smoke_notif_rcpt";
  await db.delete(users).where(eq(users.handle, handle));

  const [rcpt] = await db
    .insert(users)
    .values({
      email: "smoke-notif@example.test",
      passwordHash: "x",
      handle,
      displayName: "Smoke Recipient",
    })
    .returning({ id: users.id });

  const actor = {
    uri: "https://example.test/users/bob",
    handle: "@bob@example.test",
    name: "Bob",
  };

  console.log("1) Déduplication d'un follow non lu");
  await createFollowNotification(rcpt.id, actor);
  await createFollowNotification(rcpt.id, actor);
  assert((await countRows(rcpt.id)) === 1, "deux follows identiques non lus → 1 notification");
  assert((await countUnreadNotifications(rcpt.id)) === 1, "compteur non lues = 1");

  console.log("2) Refollow après lecture re-notifie");
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.recipientUserId, rcpt.id));
  await createFollowNotification(rcpt.id, actor);
  assert((await countRows(rcpt.id)) === 2, "refollow après lecture → 2 notifications");
  assert((await countUnreadNotifications(rcpt.id)) === 1, "compteur non lues = 1 (la nouvelle)");

  console.log("3) Nettoyage (cascade)");
  await db.delete(users).where(eq(users.id, rcpt.id));
  assert((await countRows(rcpt.id)) === 0, "suppression du compte purge ses notifications");

  console.log("\n✅ Smoke notifications OK");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
