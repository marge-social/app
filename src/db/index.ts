import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Un seul pool partagé. `postgres-js` gère le pooling ; on garde une instance
// globale en dev pour éviter d'épuiser les connexions au hot-reload Next.js.
const globalForDb = globalThis as unknown as {
  __margeSql?: ReturnType<typeof postgres>;
};

// Initialisation paresseuse : on ne lit/valide DATABASE_URL qu'à la première
// utilisation réelle. Next.js évalue les modules de route pendant le build
// (sans secrets) ; un accès au top-level ferait échouer « Collecting page data ».
function createSql(): ReturnType<typeof postgres> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const instance = globalForDb.__margeSql ?? postgres(connectionString);
  if (process.env.NODE_ENV !== "production") globalForDb.__margeSql = instance;
  return instance;
}

let sqlInstance: ReturnType<typeof postgres> | undefined;
function getSql(): ReturnType<typeof postgres> {
  return (sqlInstance ??= createSql());
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;
function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  return (dbInstance ??= drizzle(getSql(), { schema }));
}

// Proxies paresseux : conservent l'interface `db` / `sql` (appelable en tagged
// template pour `sql`, accès aux méthodes pour les deux) sans toucher à
// l'environnement tant qu'on ne s'en sert pas.
export const sql = new Proxy(
  function () {} as unknown as ReturnType<typeof postgres>,
  {
    apply(_target, thisArg, args: unknown[]) {
      return (getSql() as (...a: unknown[]) => unknown).apply(thisArg, args);
    },
    get(_target, prop) {
      const value = (getSql() as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function" ? value.bind(getSql()) : value;
    },
  },
);

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    const value = (getDb() as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

export type Database = ReturnType<typeof getDb>;
export { schema };
