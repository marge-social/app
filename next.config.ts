import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne PAS bundler le driver Postgres ni Fedify : les laisser résolus par le
  // `require` natif de Node depuis node_modules (une seule copie). Turbopack
  // dupliquait sinon `postgres` (postgres.js) en plusieurs copies à travers les
  // chunks serveur ; or postgres.js repose sur des `instanceof` (Parameter,
  // Builder, Identifier, Query) et un buffer d'octets singleton au niveau du
  // module pour sérialiser les requêtes. Avec des copies divergentes, la file
  // de messages Fedify (LISTEN/NOTIFY) sérialisait un objet JS brut au lieu
  // d'une chaîne → `Buffer.byteLength(Object)` → ERR_INVALID_ARG_TYPE, ce qui
  // crashait le worker en boucle et bloquait TOUTE la fédération (Accept jamais
  // finalisé). `pg`/`sharp`/`@node-rs/argon2`/`oslo` sont déjà externalisés par
  // défaut ; `postgres` et `@fedify/*` ne le sont pas.
  serverExternalPackages: [
    "postgres",
    "@fedify/fedify",
    "@fedify/postgres",
    "@fedify/next",
    // Externalisé pour partager l'unique instance LogTape (état module-global :
    // sinon `configure()` dans instrumentation.ts n'affecterait pas le LogTape
    // interne de Fedify).
    "@logtape/logtape",
  ],
  // `/login` n'existe plus : la connexion vit dans le portail visiteur (home
  // `/`). On renvoie toute ancienne URL (signets, liens externes) vers la home.
  async redirects() {
    return [{ source: "/login", destination: "/", permanent: true }];
  },
};

export default nextConfig;
