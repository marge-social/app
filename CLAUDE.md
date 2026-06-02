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
- **S1 ✅** : éditeur Markdown, rendu/sanitisation, permaliens stables, vue
  lecture, brouillons privés, CRUD articles.
- **S2 ✅** (code + vérif locale) : Fedify via `src/proxy.ts` (Next 16, pas de
  `runtime`), KV/queue Postgres initialisés par `src/instrumentation.ts` (qui
  démarre aussi le worker de livraison — `startQueue`, **sans `await`**). Acteur
  `Person` (`/users/:handle`, RSA `#main-key` + Ed25519), WebFinger, objet
  Article déréférençable, outbox/followers, inbox `Follow`/`Undo` (auto-Accept),
  émission `Create`/`Update`/`Delete` à la publication/édition/suppression.
  **Reste à faire par l'utilisateur** : test interop réel via tunnel public
  (`APP_URL`/`INSTANCE_DOMAIN` à pointer dessus) + compte Mastodon.
- **S3 ✅** (code + vérif locale) : inbox étendu (Create/Update/Delete →
  `remote_objects`, Accept → follow sortant accepté) ; follow interne
  Marge↔Marge (relation en base, Accept immédiat, bouton profil) ; suivre un
  acteur distant (`followRemoteActor` : WebFinger `lookupObject`, Follow
  sortant) ; fil `/feed` fusionnant articles locaux suivis + objets distants en
  ordre chronologique strict. Vérifié localement : follow/unfollow interne →
  fil alimenté. Ingestion entrante & suivi distant réels : via le test Mastodon.
- **S4 ✅** (vérifié en local) : lib RSS (`src/lib/rss.ts` : auto-découverte
  `<link rel=alternate>`, parsing `rss-parser`, User-Agent crawler pointant vers
  `/feeds/[id]`, extrait), référencement orphelin + Blocklist (`src/lib/blocklist.ts`),
  polling mutualisé + dé-doublonnage GUID (`src/lib/poll.ts`), endpoint cron
  `/api/cron/poll` (protégé `CRON_SECRET`), abonnement `FeedSubscription`
  (indépendant du follow de compte), pages `/feeds` et `/feeds/[id]`, items
  (extrait + lien) dans le fil unifié.
- S5→S7 : voir le plan. Prochain : **S5 (propriété des flux : réclamation +
  opt-out)**.

### Cron RSS
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/poll`. À brancher
sur une vraie tâche cron en prod.

### Fixtures de test RSS
`public/test-feed.xml` + `public/test-blog.html` (auto-découverte) servent au
test local du référencement/polling.

### Note résumé d'article
`articles.summary` stocke le **chapô explicite** de l'auteur (souvent vide) ;
le résumé effectif est dérivé du contenu via `effectiveSummary()` (toujours
frais). Ne pas réintroduire de résumé dérivé figé en base.

### Test fédération réel (à faire)
1. Lancer un tunnel : `cloudflared tunnel --url http://localhost:3000` (ou ngrok).
2. Mettre `APP_URL` et `INSTANCE_DOMAIN` (`.env`) sur l'URL/host publics, relancer.
3. Depuis Mastodon, chercher `@<handle>@<host-tunnel>`, suivre, publier un texte.
