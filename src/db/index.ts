import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Un seul pool partagé. `postgres-js` gère le pooling ; on garde une instance
// globale en dev pour éviter d'épuiser les connexions au hot-reload Next.js.
const globalForDb = globalThis as unknown as {
  __margeSql?: ReturnType<typeof postgres>;
};

export const sql = globalForDb.__margeSql ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb.__margeSql = sql;

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
