// Applique les migrations Drizzle en production, sans drizzle-kit (devDep).
// N'utilise que des dépendances de production : `postgres` + le migrator de
// drizzle-orm. Lancé par le service `migrate` du docker-compose avant l'app.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant — migration impossible.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./src/db/migrations" });
  console.log("✓ Migrations appliquées.");
} catch (err) {
  console.error("✗ Échec des migrations :", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
