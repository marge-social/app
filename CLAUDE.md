@AGENTS.md

# Marge

Média social de contenus longs, sourcés et fédérés (ActivityPub), à
contre-courant de l'économie attentionnelle. Spécification complète :
[docs/cahier-des-charges.md](docs/cahier-des-charges.md). Plan de sprints :
`~/.claude/plans/federated-singing-wirth.md`.

Le MVP démontre trois choses : **agréger** (flux RSS internes), **publier**
(Articles Markdown) et **fédérer** (suivable depuis Mastodon).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript — ⚠️ Next 16 a des ruptures
  d'API (voir AGENTS.md). Notamment : le hook Fedify va dans `proxy.ts` (pas
  `middleware.ts`) ; `params`/`cookies()` sont **async**.
- **PostgreSQL** + **Drizzle ORM** (`src/db/schema.ts`).
- **Fedify** (`@fedify/fedify`, `@fedify/next`, `@fedify/postgres`) — fédération.
  Cache + queue sortante via l'adaptateur Postgres (pas de Redis au MVP).
- **Auth** maison : sessions opaques (`@oslojs`), mots de passe argon2id
  (`@node-rs/argon2`). Clés d'acteur AP chiffrées AES-GCM (`src/lib/crypto.ts`).

## Conventions

- Routes profil : `/@handle` via la route dynamique racine `src/app/[handle]/`.
  Le segment arrive **URL-encodé** (`%40claire`) → décoder avec
  `decodeURIComponent` avant de tester le préfixe `@`.
- Server actions dans `src/app/actions/`. Helpers d'instance dans
  `src/lib/config.ts` (`actorUri`, `fediverseHandle`, `articleUrl`).
- Deux objets suivables **strictement découplés** : compte AP (fédéré) vs flux
  RSS (`feed_subscriptions`, interne, ne fédère jamais).

## Commandes

```bash
npm run dev                      # serveur de dev (port 3000)
npm run db:generate              # génère une migration depuis schema.ts
npm run db:migrate               # applique les migrations
npm run db:studio                # explorateur Drizzle
npx tsc --noEmit                 # typecheck
npx tsx scripts/smoke-s0.ts      # test fumée S0 (crypto + persistance)
```

## Base de données (dev)

Postgres via Homebrew (`brew services start postgresql@16`). Base `marge`.
`DATABASE_URL` et secrets dans `.env` (voir `.env.example`).

## Avancement

- **S0 ✅** : socle, schéma complet (11 tables), auth multi-comptes, profils.
- S1→S7 : voir le plan de sprints. Prochain : S1 (publication Markdown).
