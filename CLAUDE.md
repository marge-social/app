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
- **S5 ✅** (vérifié en local) : vérification par jeton (preuve de contrôle
  commune réclamation/opt-out — `src/app/actions/claims.ts`), réclamation
  (→ `claimed`, propriétaire, toggle texte intégral), opt-out (dé-référencement
  feed+items+subs + Blocklist + re-référencement bloqué). Page publique du flux
  `/feeds/[id]` (`ClaimPanel`), flux déclarés sur le profil (suivi de flux
  distinct du suivi de compte), déclaration depuis `/settings`.
  ⚠️ L'opt-out bloque l'**URL exacte** (pas le domaine) pour ne pas sur-bloquer
  les hébergeurs multi-tenant.
- **S6 ✅** : fil unifié chronologique strict des 3 sources (comptes Marge,
  Fediverse, flux RSS) avec aperçus honnêtes (titre, source, date, extrait,
  temps de lecture) et aucun compteur d'engagement ; export Markdown
  (`/api/export/markdown`) et OPML (`/api/export/opml`), liens dans /settings.
- **S7 ✅** (vérifié en local) : suppression de compte effective (RGPD) avec
  émission immédiate d'un `Delete(Person)` fédéré avant purge en cascade
  (`src/app/actions/account.ts`, danger zone dans `/settings`) ; accessibilité
  (lien d'évitement, `:focus-visible`, `lang=fr`, HTML sémantique, labels) ;
  modération minimale : blocage d'un acteur distant (table `actor_blocks`,
  rupture du suivi + exclusion du fil, déblocage). Signalement & modération
  avancée : V2.

**MVP COMPLET (S0–S7).** Tous les critères §9 du cahier sont satisfaits en
local. Reste : tests d'interop Mastodon réels (S2/S3) via tunnel public.

### V1 (post-MVP)

- **Lot 1 — Notifications ✅** : table générique `notifications` (seul `follow`
  émis en V1), créée sur Follow entrant (inbox Fedify) ET sur follow local, avec
  déduplication des non-lues ; page `/notifications`, badge de non-lues dans la
  nav (`src/lib/notifications.ts`).
- **Lot 2 — Administration ✅** : rôle `users.role` (`user`|`admin`), garde
  serveur `requireAdmin()` sur `/admin/*` (layout + chaque page),
  `/admin/accounts` et `/admin/posts` en lecture seule, CLI d'amorçage
  `scripts/make-admin.mjs` (cf. DEPLOY.md §2 bis).
- **Lot 3 — Home unifiée ✅** : la home `/` EST le fil unifié + un composer en
  tête (un seul champ, Markdown). Fil construit par `src/lib/feed.ts` (billets +
  notes des comptes suivis **et de soi**, objets distants, items RSS), notes
  affichées en entier, billets/RSS/distant en aperçu. `/feed` et `/feeds`
  (lecture) redirigent vers `/` ; `/feeds/[id]` (détail/réclamation) conservé.
- **Lot 4 — Recherche ✅** : `/recherche?q=` (ILIKE) en 3 sections Contenus /
  Comptes / Flux, public uniquement ; détection `@user@instance` → suivi
  WebFinger. tsvector/GIN = amélioration V2.
- **Lot 5 — Compte ✅** : édition de profil (nom, bio, avatar) sur `/@handle` en
  mode propriétaire — **pas de route `/profil`** ; déclaration de ses flux
  relocalisée sur le profil. Avatars stockés en base (`user_avatars`, bytea),
  servis par `/api/avatar/[handle]`, exposés en `Person.icon`. `/preferences`
  (remplace `/settings`, redirigé) : infos compte, **changement de mot de passe**
  (vérif. actuel + argon2 + invalidation des autres sessions), abonnements/
  blocages, exports, suppression de compte.

> **Décision objet AP (Note vs Article).** Les messages du composer (sans titre)
> sont publiés comme **`Note`** (microblog), distincts des `Article` (billets
> titrés). Voir `buildNoteObject`/`buildCreateForNote` + dispatcher Note
> `/users/:handle/notes/:id` dans `src/federation/federation.ts`, table `posts`,
> permalien humain `/@handle/notes/[id]`. Les `Article` restent inchangés.

**V1 vérifiée en local** (build/lint/tsc + parcours réel : composer→Note fédérée
& déréférençable, recherche, édition profil+avatar, changement de mot de passe,
redirections). Reste : interop Mastodon réelle via tunnel.

### v0.2 — Interactions sociales & Notifications (en cours)

Spécification : [le cahier v0.2](docs/cahier-des-charges-v0.2-interactions.md) (4
primitives : Like, commentaire court, réponse-billet, partage ; notifications
réglables ; anti-dark-patterns). **Arbitrages tranchés** : §8 compteurs =
**option (c)** (visibles de tous, jamais utilisés pour trier).

- **Lot Like ✅** (vérifié en local) : table générique `interactions` (journal
  Like/Announce/Comment/Reply ; IRI acteur+objet ; `origin` local|federated ;
  `undone_at` pour les bascules ; index partiel unique sur (type,acteur,objet)
  pour Like/Announce → idempotence §2.1). `src/lib/interactions.ts` :
  `setLike` (toggle, dé-like = `undone_at`, re-like = réactivation),
  `getLikeStatsFor` (compte agrégé sans N+1), `resolveLikeTarget` (valide qu'on
  ne like qu'un objet connu — billet/note local publié ou objet distant ingéré).
  Émission `Like`/`Undo(Like)` vers l'auteur distant (`buildLike` +
  `deliverLike`/`deliverUndoLike`, id déterministe `#likes/<objet>`) ; inbox
  `.on(Like)` + `.on(Undo)` étendu → journalise les likes reçus sur nos objets
  (origin=federated). Compteur **public discret** sous chaque entrée du fil
  (`FeedList`, masqué à 0), action `toggleLikeAction`. **Pas de notification de
  like** : signal pauvre, remis en *digest* par défaut (§4.3) → le digest lira
  `interactions`. Reste du module : commentaires, réponses-billets, partages,
  matrice de notifications + digest.

- **Lot Commentaire court ✅** (vérifié en local) : `posts.inReplyToUri` +
  `remoteObjects.inReplyToUri` (une Note avec `inReplyTo` = commentaire, exclue
  du fil top-level, affichée **sous** son parent — §2.2). `buildNoteObject` pose
  `replyTarget` (→ `inReplyTo`) ; `buildCreateForNote` cc l'auteur d'origine ;
  `deliverComment` livre aux followers + à l'auteur distant. Inbox `.on(Create)`
  capture `inReplyTo` et, si le parent est local, crée une notification
  (`comment` pour une Note, `reply` pour un Article — **temps réel** par défaut,
  §4.3) via `createReplyNotification`. Action `createCommentAction` (≤500 car.,
  `resolveInteractionTarget` partagé avec le like) ; fil threadé + champ de
  réponse dans `FeedList` (`buildFeed` charge les commentaires locaux+distants
  par parent) ; page `/notifications` rend les types + lien profond « voir ».
  Helper `cacheRemoteActor` factorisé (Follow + Create). Vérifié : commentaire
  local affiché sous le contenu & exclu du top-level, notification temps réel
  inter-comptes (bob→alice) avec permalien. Reste du module : réponses-billets,
  partages (`Announce`), matrice `notification_settings` + digest.

- **Lot Réponse-billet ✅** (vérifié en local) : `articles.inReplyToUri`
  (Article + inReplyTo, §2.3). **Double existence** : reste en top-level du fil
  (publication autonome) ET rattaché au parent comme **référence titrée** dans le
  thread. `buildArticleObject` pose `replyTarget` ; `buildCreateForArticle` cc
  l'auteur d'origine ; `deliverCreate(handle, article, parentAuthorActorUri?)`
  livre aussi à l'auteur distant. `saveArticleAction` lit `inReplyTo` (création
  seulement), stocke, et à la publication notifie l'auteur local (`reply`, temps
  réel §4.3, sauf auto-réponse) ou fédère au distant. Éditeur atteint via
  `/compose?replyTo=<IRI>` (bandeau « En réponse à… », hidden `inReplyTo`) ; lien
  « Répondre par un billet » sous chaque entrée du fil. `buildFeed` n'exclut du
  top-level que les **Notes**-réponses distantes (les Articles-réponses restent
  visibles, double existence) ; thread charge commentaires (Notes, en entier) +
  réponses-billets (Articles, lien titré) locaux & distants. Helper partagé
  `humanObjectUrl` (config) pour les permaliens humains. Vérifié : réponse-billet
  affichée top-level + référence threadée sous le parent ; notif `reply` temps
  réel inter-comptes (dave→carol). Reste du module : partages (`Announce`),
  matrice `notification_settings` + digest.

- **Lot Partage ✅** (vérifié en local) : bascule `Announce`/`Undo` (§2.4),
  journalisée dans `interactions` (même mécanique que le Like). Lib généralisée
  `setLike`→`setToggle(type,…)` + `getLikeStatsFor`→`getToggleStatsFor(type,…)`.
  `buildAnnounce` (id déterministe `#announces/<objet>`, vers followers) ;
  `deliverAnnounce`/`deliverUndoAnnounce` ; inbox `.on(Announce)` (journalise +
  **déréférence/ingère** l'objet partagé dans `remoteObjects`) et `.on(Undo)`
  étendu. **Ré-émission** dans le fil : `buildFeed` surface les objets annoncés
  par les comptes suivis **+ soi** (libellé « partagé par X », daté à l'instant
  du partage), résolus en lots (articles/notes locaux + `remoteObjects`).
  `toggleAnnounceAction` (livre aux followers du partageur). `ShareButton` dans
  `FeedList` (compteur public visible, **jamais** utilisé pour trier — §6/§8c).
  **Pas de notification** (signal pauvre, défaut *digest* §4.3 → le digest lira
  `interactions`). Vérifié : toggle + compteur ; ré-émission visible par un
  abonné du partageur **qui ne suit pas l'auteur** (gina↛eve, via frank) ;
  dé-partage réversible (soft-undo, le boost disparaît). Reste du module :
  matrice `notification_settings` (canal × portée) + moteur de digest.

- **Lot Notifications réglables (matrice, §4.2) ✅** (vérifié en local) : tables
  `notification_settings` (dérogations par user×type) + `digest_items` (file) +
  `notifications.group_count`. **Routeur unique** `routeInteractionNotification`
  (`src/lib/notifications.ts`) : applique **portée** (local/fédéré/all) puis
  **canal** (`off`→rien ; `digest`→file ; `realtime`→notif immédiate, dédupliquée
  pour like/announce). Défauts « calm by default » §4.3 résolus en code
  (`DEFAULT_NOTIF_SETTINGS` : reply/comment=temps réel, announce/like=digest,
  portée all). Les 4 types y passent (actions like/announce/comment + saveArticle
  reply + inbox `.on(Like/Announce/Create)` via `notifyToggleTarget`). UI matrice
  4×(canal,portée) dans `/preferences` (`saveNotificationSettingsAction`).
  Vérifié : défaut like→digest (file, pas d'interruption) ; like→temps réel après
  réglage → notif immédiate ; réglages persistés.
- **Lot Digest (moteur, §4.3/§4.4) ✅** (vérifié en local) : `src/lib/digest.ts`
  `runDigest()` regroupe les `digest_items` en attente par (destinataire, type,
  objet), compte les **acteurs distincts** (like/announce filtrés sur les
  `interactions` encore actives → un like annulé ne gonfle pas le total), crée
  **une** notification groupée (`group_count` + acteur représentant) et marque
  les items `digested_at`. Idempotent. Endpoint cron `/api/cron/digest` (protégé
  `CRON_SECRET`). Rendu groupé « X et N-1 autres ont … » (§4.4) dans
  `/notifications`. Vérifié : 2 likes (défaut digest) → 1 notif « Mia et 1 autre
  ont aimé… », file vidée, re-run idempotent.

**MODULE INTERACTIONS COMPLET (§2 les 4 primitives + §4 notifications réglables
& digest).** Reste : tests d'interop Mastodon réels via tunnel.

### Médias — stockage objet OVH (S3) + pièces jointes ✅ (vérifié en local)

Spécification : `marge-cdc-medias-stockage-s3`. Tous les médias (pièces jointes
des posts/billets **et** avatars) sur un bucket S3 OVH, servis depuis une
**origine séparée** `media.<domaine>` (sécurité : isole le contenu des cookies).

- **Stockage** : `src/lib/storage.ts` (client S3 paresseux, `putObject` pose
  **`ACL: public-read` + `Content-Type`** validé — pas de bucket policy sur GRA ;
  clés UUID, jamais le nom fourni). URL via `mediaUrl()`/`MEDIA_BASE_URL`
  (`src/lib/config.ts`).
- **Validation/traitement** : `src/lib/media.ts` (**pur**, testable sans réseau).
  Liste **blanche** par *magic bytes* (`file-type`) : jpg/png/gif/webp, pdf,
  mp4/webm, mp3 ; **5 Mo** max ; rejet si extension annoncée ≠ contenu. Images
  re-encodées + **EXIF purgé** + dimensions + **miniature** (`sharp`). PDF servis
  en `Content-Disposition: attachment`. `processUpload` (validation) puis
  `persistMedia` (S3 + insert), `loadMediaFor{Posts,Articles}` (sans N+1).
- **Modèle** : table `media` (FK nullable `postId`/`articleId` → **1 média/post**
  en V1, extensible) ; `users.avatarMediaId` (avatars S3, fallback bytea legacy
  conservé) ; `remoteObjects.attachments` (jsonb, PJ distantes). Migration
  `0008`. **FK circulaire** users↔media : thunk `(): AnyPgColumn => media.id`.
- **Upload** : champ fichier + **texte alternatif sans friction** (apparaît au
  choix d'une image, obligatoire) dans `Composer`/`EditorForm` ; avatar dans
  `ProfileEditForm`. Actions `createPostAction`/`saveArticleAction`(création)/
  `updateProfileAction` : valident AVANT toute écriture, puis S3 (best-effort).
- **Fédération** : `attachment` (Document/Image, `name`=alt) sur Note/Article
  (builders + dispatchers + outbox + livraison) ; **`icon`** acteur = URL média
  S3 ; inbox `.on(Create/Update/Announce)` ingère les PJ distantes
  (`extractRemoteAttachments`, liste blanche). `/api/avatar/[handle]` redirige
  (302) vers le média S3 si présent, sinon sert l'octet legacy.
- **Affichage** : `media: MediaView[]` sur `FeedEntry` (chargé en lot), composant
  `Attachments` (image inline+alt, lecteurs vidéo/audio, PDF en lien) dans le fil
  + vues détaillées article/note.
- **Déploiement** : bloc Caddy `{$MEDIA_DOMAIN}` (reverse-proxy bucket, réécrit
  `Host`) + `request_body max_size 6MB` ; vars `S3_*`/`MEDIA_*` dans
  docker-compose + `.env*.example` ; `DEPLOY.md` §2 ter (bucket, ACL, DNS, clés).

Vérifié en local : `tsc`/`lint`/`build` OK + `scripts/smoke-media.ts`
(zip/js/exe-renommé/>5 Mo rejetés ; EXIF purgé ; miniature ; pdf OK). **Reste :
round-trip S3 réel** (credentials OVH) + affichage Mastodon via tunnel.

### Ingestion des contenus distants suivis ✅ (build/tsc/lint OK)

Les publications des comptes ActivityPub suivis (Mastodon, **PeerTube**…)
alimentent le fil. Le chemin « push » (inbox `.on(Create)` → `remoteObjects` →
`buildFeed`) existait déjà mais laissait le fil **vide après l'abonnement** :

- **Backfill à l'abonnement** (`backfillRemoteOutbox`, `src/federation/federation.ts`) :
  `followRemoteActor` récupère l'outbox **public** de l'acteur
  (`actor.getOutbox()` + `ctx.traverseCollection`, `suppressError`) et ingère ses
  ~20 contenus récents → le fil se remplit sans attendre une publication poussée.
  Best-effort : un échec ne fait jamais échouer l'abonnement (déjà persisté).
- **Types élargis** : `upsertRemoteObject` + gardes `Create`/`Update`/`Announce`
  acceptent désormais `Note | Article | Video | Page` (helper `isIngestableObject`
  + `remoteObjectType`). Les `Video` (PeerTube) étaient auparavant rejetés. Pas de
  migration (`remote_objects.type` est du texte libre).

Reste : vérif d'interop réelle (Mastodon/PeerTube) via tunnel — cf. ci-dessous.

### Cron digest
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/digest`. À brancher
sur une tâche cron (quotidien par défaut, §4.3). Regroupe les signaux pauvres
(like/announce et tout type réglé sur `digest`) en notifications « N personnes… ».

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
