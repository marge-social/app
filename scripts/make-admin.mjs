// Amorçage du premier administrateur (§3.2). Promeut un compte local en
// `role=admin` à partir de son nom d'utilisateur (handle).
//
// N'utilise que des dépendances de production (`postgres`), comme migrate.mjs,
// pour rester exécutable dans le conteneur sans drizzle-kit.
//
// Usage : node scripts/make-admin.mjs <username>
//   docker compose exec app node scripts/make-admin.mjs karl
import postgres from "postgres";

const username = process.argv[2]?.trim().replace(/^@/, "");
if (!username) {
  console.error("Usage : node scripts/make-admin.mjs <username>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant — promotion impossible.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  const rows = await sql`
    UPDATE users SET role = 'admin'
    WHERE handle = ${username}
    RETURNING handle, role
  `;
  if (rows.length === 0) {
    console.error(`✗ Aucun compte avec le handle « ${username} ».`);
    process.exitCode = 1;
  } else {
    console.log(`✓ @${rows[0].handle} est désormais ${rows[0].role}.`);
  }
} catch (err) {
  console.error("✗ Échec de la promotion :", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
