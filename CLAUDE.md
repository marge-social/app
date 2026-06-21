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

## Dépendances
Chaque dépendance est une surface d'attaque (chaîne
d'approvisionnement), une dette de maintenance et un coût de soutenabilité. Règle
par défaut : **on n'ajoute pas une dépendance qu'on peut écrire proprement en
local**.

### Avant d'ajouter une dépendance

Le justifier explicitement (message de commit / description de PR) en répondant à :

1. **Besoin** — qu'est-ce que ça résout qu'on ne sait pas faire en ~30 lignes
   pures et testables ?
2. **Coût** — poids installé **et nombre de dépendances transitives**
   (`npm ls <pkg>`), pas seulement la taille du paquet lui-même.
3. **Confiance** — mainteneur actif ? publication récente ? téléchargements ?
   `npm audit` propre ? (méfiance accrue pour un paquet à mainteneur unique.)
4. **Réversibilité** — peut-on la retirer plus tard sans réécrire la moitié de
   l'app ?

Ordre de préférence : **bibliothèque standard / API Web natives** → **fonction
locale pure** (dans `src/lib/`, avec un smoke test) → **micro-dépendance ciblée** →
en dernier recours seulement, une grosse lib généraliste.

Ne **jamais** ajouter de dépendance pour une fonction triviale (style `left-pad` :
formatage de chaîne, petit helper de tableau/date, slug…). Le projet écrit déjà
ce type d'utilitaires en local (`toSlug`, `htmlToText`, `pickBestVideoFile`,
`effectiveSummary`…) — continuer ainsi.

### Liste blanche — à NE JAMAIS réimplémenter maison

Marge traite du **contenu distant non fiable** (fédération) et gère
authentification + cryptographie. Réécrire ces briques soi-même = faille quasi
garantie. Toujours passer par la lib éprouvée déjà en place :

- **Sanitisation HTML** — `isomorphic-dompurify` (XSS sur le HTML fédéré / rendu Markdown).
- **Hachage de mot de passe** — `@node-rs/argon2` (argon2id).
- **Crypto & encodage bas niveau** — `@oslojs/crypto`, `@oslojs/encoding`.
- **Validation d'entrée / schémas** — `zod`.
- **Détection de type de fichier par *magic bytes*** — `file-type` (validation d'upload).
- **Traitement d'image / purge EXIF** — `sharp`.
- **Parsing Markdown** — `marked` (et sa sortie est **toujours** re-sanitisée).

### Audit du parc existant

Périodiquement, et avant toute montée de version majeure de Next :

```
npm audit                        # vulnérabilités connues dans l'arbre
npx depcheck                     # dépendances déclarées mais jamais importées
npx knip                         # dépendances + exports + fichiers morts (plus fin)
npm ls <pkg>                     # pourquoi <pkg> est là (qui le tire)
```

⚠️ **Faux positifs attendus sur cette stack — NE PAS retirer sans vérifier :**

- `eslint-config-next`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `eslint`,
  `typescript`, `@types/*` — outillage build/lint, jamais « importé » dans `src/`.
- `drizzle-kit`, `tsx`, `dotenv` — invoqués par les **scripts npm** et les
  `scripts/*.mjs` (migrate, make-admin, backfill…), pas par le code applicatif.
- `@js-temporal/polyfill` — polyfill ; à retirer le jour où `Temporal` est natif.

Procéder **une dépendance à la fois** : retirer →
`npx tsc --noEmit` + `npm run lint` + `npm run build` + smoke tests concernés →
commit. Un retrait « qui semble inutilisé » peut être chargé dynamiquement
(`import()`), via un script de build, ou en peerDependency.

Note de cadrage : le poids de `node_modules` (modules natifs `sharp`, `argon2`,
AWS SDK S3) est **normal** et n'est pas l'indicateur à suivre. Suivre plutôt le
**nombre de dépendances directes** et l'évolution de l'arbre transitif.

### Lien avec la gouvernance (ADR)

Ajouter une **dépendance structurante** (brique runtime non triviale : client
réseau, moteur de rendu, lib crypto/sécurité, ou remplacement d'une lib de la
liste blanche) est une **décision de conception** → suivre le *Rituel de capture*
et rédiger un ADR (`docs/decisions/`) consignant l'alternative locale écartée et
le pourquoi. Une micro-dépendance ciblée n'a pas besoin d'ADR, seulement de la
justification en PR.

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

### Médias des contenus distants — photos Mastodon & vidéos PeerTube ✅ (vérifié en local)

Les médias des contenus distants suivis s'affichent dans le fil, et **les vidéos
PeerTube se lisent directement dans Marge** (sans quitter le site, sans iframe
tierce).

- **Photos Mastodon** : déjà couvertes par `extractRemoteAttachments` (PJ
  `Document/Image`, liste blanche `image/*`) → rendues par le composant
  `Attachments`. Inchangé.
- **Vidéos PeerTube** : un objet `Video` ne porte pas sa vidéo dans `attachment`
  mais dans son tableau `url` (un `Link` par résolution mp4/webm + une playlist
  HLS `application/x-mpegURL`) et sa vignette dans `icon`. Nouveau
  `extractVideoMedia` (`src/federation/federation.ts`, appelé par
  `upsertRemoteObject` quand `object instanceof Video`) : itère `object.urls`,
  retient le meilleur mp4/webm (`pickBestVideoFile` : plus haute déf ≤ 720p,
  sinon plus basse) **ou** à défaut la playlist HLS, extrait la vignette
  (`extractFirstIconUrl` via `getIcons`) et privilégie le lien `text/html`
  (page web) comme lien de l'entrée. URL distantes conservées telles quelles
  (jamais re-hébergées, cf. §4.2).
- **Modèle** : `RemoteAttachment` (jsonb `remote_objects.attachments`) gagne
  `poster?` (vignette) + `hlsUrl?` ; `MediaView` gagne `hlsUrl?`
  (`thumbnailUrl` sert de poster). Pas de migration (jsonb texte libre).
- **Lecture** : nouveau composant **client** `src/components/VideoPlayer.tsx` —
  **aucune lecture automatique** (éthos anti-attention) : tant qu'il y a une
  vignette, on n'affiche que le poster + un bouton « Lire » ; au clic, lecture
  native (`<video>`) pour le mp4, sinon HLS via **hls.js importé à la demande**
  (`import("hls.js")` au clic, pas dans le bundle initial), avec repli natif
  Safari (`canPlayType("application/vnd.apple.mpegurl")`). `Attachments` route
  les vidéos vers ce lecteur. Dépendance ajoutée : `hls.js`.

Vérifié en local : `tsc`/`lint`/`build` OK + parcours réel via route de test
jetable (`Attachments` avec un flux HLS public) → poster + bouton, clic →
bascule en `<video controls>`, flux m3u8 chargé et **en lecture** dans Marge.
Reste : vidéo PeerTube réelle via tunnel.

### Mesure d'audience — Matomo (RGPD sans bandeau) ✅ (vérifié en local)

`src/components/MatomoAnalytics.tsx` (client) monté par le layout racine
(`src/app/layout.tsx`) **uniquement si** `MATOMO_URL` + `MATOMO_SITE_ID` sont
définis (env **runtime**, lue côté serveur et passée en props — **pas** de
`NEXT_PUBLIC_*` : elles seraient inlinées au `next build`, étape Docker sans les
variables runtime). Conçu pour être conforme **sans bandeau de consentement**
(mesure d'audience exemptée, lignes directrices CNIL → pas de dark pattern) :
- **sans cookie** (`disableCookies`) ; **respecte Do Not Track / GPC** (aucune
  collecte si le signal est actif) ; n'envoie que le **chemin** (`origin +
  pathname`), jamais la query string (ni terme de recherche, ni jeton).
- Suit les **navigations SPA** de l'App Router via `usePathname` (re-`trackPageView`
  avec référent = URL précédente).
- ⚠️ À activer **aussi côté serveur Matomo** (requis pour l'exemption) :
  anonymisation d'IP ≥ 2 octets + respect DNT. Et mentionner la mesure dans une
  page « vie privée / mentions légales » (à créer).

Vars dans `docker-compose.yml` (service `app`) + `.env*.example`. Prod :
`MATOMO_URL=https://analytics.kilometre-0.fr`, `MATOMO_SITE_ID=10`.

### Pages de contenu éditables (CMS minimal) ✅ (vérifié en local)

Pages publiques **éditables en Markdown par les admins**, chacune à une URL
**propre à la racine** (`/mentions-legales`, `/a-propos`…). Les mentions légales
sont **une** de ces pages (page « par défaut » fournie par le code).

- **Stockage** : table `site_pages` (slug PK, `content_markdown` + `content_html`
  sanitisé pré-rendu, `updated_at` ; migration `0009`).
- **Lib** `src/lib/pages.ts` : `getPage(slug)` (ligne enregistrée, sinon contenu
  par défaut rendu à la volée, sinon `null`), `listPages()`, `DEFAULT_PAGES`
  (mentions légales = `DEFAULT_LEGAL_MARKDOWN`, avec section Matomo/RGPD),
  `RESERVED_SLUGS` (routes statiques racine : login/feeds/admin/… + `new`),
  `isValidSlug`/`toSlug`.
- **Public** : résolu par la route racine `src/app/[handle]/page.tsx` — segment
  **sans** préfixe `@` → `getPage(slug)` → `SitePageView` (sinon `notFound`).
  Les routes statiques priment sur cette route dynamique ; `generateMetadata`
  gère titre page **et** profil. ⚠️ Plus de route statique `/mentions-legales`.
- **Admin** (`requireAdmin`) : `/admin/pages` (liste + « Nouvelle page »),
  `/admin/pages/new`, `/admin/pages/[slug]` (édition + suppression).
  `PageEditorForm` (Rédiger/Aperçu) ; `savePageAction` (création : slug validé +
  réservé + unicité, puis **immuable** ; édition : upsert), `deletePageAction`.
- Lien `/mentions-legales` dans `SiteFooter`. Supprimer une page « par défaut »
  la ramène à son contenu par défaut. Extensible sans migration.

### Image d'aperçu des items RSS dans le fil ✅ (vérifié en local)

Pour qu'un visuel s'affiche dans le **maximum de cas**, chaque item RSS porte
désormais une image d'aperçu détectée comme « la plus pertinente probable ».

- **Détection sans réseau** (`detectInlineImage`, `src/lib/rss.ts`) par ordre de
  fiabilité : Media RSS (`media:content`/`media:thumbnail`, y compris dans un
  `media:group`) → `enclosure` typée image → image iTunes → premier `<img>` du
  contenu HTML. URL résolue en absolue http(s) (relatives gérées, `data:` exclu),
  **jamais réhébergée** (cf. F3). `customFields` du `Parser` exposent le namespace
  `media:`.
- **Repli réseau** (`fetchOgImage`) : si aucune image inline, on lit l'`og:image`
  (sinon `twitter:image`) de la page de l'article — la vignette choisie par
  l'éditeur. Best-effort, timeout 8 s, **borné à `OG_FETCH_BUDGET=25`** récup. par
  flux et par passe (`src/lib/poll.ts`), et **uniquement pour un item nouveau**
  (vérif d'existence avant l'insert) → pas de coût réseau sur les items déjà connus.
- **Stockage** : colonne `feed_items.image_url` (migration `0011`). Les items déjà
  en base ne sont pas rétro-remplis par le polling (insert `onConflictDoNothing`
  inchangé) ; les nouveaux le sont. **Backfill ponctuel** :
  `scripts/backfill-rss-images.mjs` (autonome, deps de prod seules — comme
  `migrate.mjs`/`make-admin.mjs` ; idempotent, `--dry-run`/`--limit=N`) remplit
  l'existant via première image du contenu stocké puis repli og:image.
  `docker compose exec app node scripts/backfill-rss-images.mjs`.
- **Rendu** : `buildFeed` projette `image_url` → `MediaView` image
  (`rssImageMediaViews`, mime deviné par extension) → composant `Attachments`
  existant (aucune modif UI). Vérifié : `scripts/smoke-rss-image.ts` couvre les 4
  sources (fixtures `public/test-feed.xml` enrichi + `og:image` sur
  `public/test-blog.html`).

### Recherche unifiée — profil fédéré & flux RSS résolus en direct ✅ (tsc/lint OK, route compile)

`/recherche?q=` reste **une seule barre, une seule requête**, mais résout
désormais activement les deux cas externes (avant : un formulaire vide « Suivre
un compte du Fediverse »).

- **Profil fédéré** : si `q` ressemble à `@user@instance`, `previewRemoteActor`
  (`src/federation/follow.ts`) résout l'acteur par WebFinger (`ctx.lookupObject`)
  **pour l'afficher** (uri, handle reconstruit, nom, bio nettoyée via
  `htmlToText`, avatar via `getIcon`, url) — **sans suivre ni persister**,
  best-effort (`null` si introuvable). Rendu par `RemoteProfileResult` (carte en
  tête de la section **Comptes**) avec bouton **Suivre** pré-rempli (réutilise
  `followRemoteAction`).
- **Flux RSS** : si `q` est une URL `http(s)://`, `previewFeed` (`src/lib/rss.ts`)
  auto-découvre + parse le flux **pour l'afficher** (titre, description, nombre
  d'items) sans persister. La page (`resolveFeedDiscovery`) croise avec
  `isBlocked` + flux déjà existant → carte `FeedDiscoveryResult` (bouton
  **Ajouter ce flux** pré-rempli, réutilise `referenceFeedAction`), OU lien
  « déjà référencé », OU note opt-out/illisible. En tête de la section **Flux**.
- Les deux résolutions externes tournent **en parallèle** des requêtes locales
  (`Promise.all`). Composant `RemoteFollowForm` supprimé (n'était utilisé que par
  l'ancien bloc). Reste : vérif du parcours connecté (réseau + session) — handle
  Mastodon réel + URL de flux.

### Chaînes YouTube — résolveur de flux + lecteur intégré ✅ (vérifié en local)

Une chaîne YouTube s'ajoute comme **n'importe quel flux RSS** (objet
`feed_subscriptions`, jamais un follow de compte) et ses vidéos se **lisent dans
le fil** comme les vidéos PeerTube. Le flux d'abonnements personnel
(`/feed/subscriptions`) reste hors de portée : authentifié, ce n'est pas un flux.

- **Résolveur** (`src/lib/youtube.ts`) : `resolveYouTubeFeedUrl` convertit une URL
  **ou un `@handle`** de chaîne en flux Atom public `/feeds/videos.xml`. Sans
  réseau pour `/channel/UC…`, `/playlist?list=…` et un flux déjà formé ; **une**
  requête HTML pour `/@handle`, `/c/`, `/user/`, `/watch?v=…` (extraction du
  `channel_id` via le lien d'auto-découverte, l'URL canonique `/channel/UC…` ou
  `"channelId"` du `ytInitialData`). ⚠️ Le `channel_id` est enfoui **loin** dans
  la page (~600 Ko sur 2,3 Mo) → on cherche large (cap 4 Mo). Branché en tête de
  `discoverFeedUrl` (`src/lib/rss.ts`) → marche pour `/recherche` **et** l'ajout
  de flux, sans toucher les appelants.
- **Vignette** : `detectInlineImage` lit désormais `media:thumbnail` **niché dans
  `media:group`** (structure YouTube), avec repli déterministe
  `i.ytimg.com/vi/<id>/hqdefault.jpg`.
- **Lecteur** (`rssMediaViews` dans `src/lib/feed.ts` → `MediaView.embedUrl` →
  `Attachments` → `VideoPlayer`) : un item dont le lien est une vidéo YouTube
  (`youtubeVideoId`) devient une `MediaView` vidéo **embed**. ⚠️ YouTube n'expose
  **aucun flux brut** (contrairement à PeerTube) : le seul moyen de lire dans la
  page est l'**iframe d'embed** — exception assumée au « sans iframe tierce »,
  atténuée par `youtube-nocookie.com` + montage **au clic uniquement** (poster +
  bouton « Lire », pas d'autoplay, pas d'iframe au repos → éthos anti-attention).
- **Pas de revendication** : un flux YouTube n'est pas le blog de l'utilisateur →
  `/feeds/[id]` masque le `ClaimPanel` quand `isYouTubeFeedUrl(feed.feedUrl)`
  (abonnement seulement ; réclamation/opt-out à revoir plus tard).
- Vérifié : `scripts/smoke-youtube.ts` (résolveur + id/embed, offline) ; round-trip
  réseau réel (`@mkbhd`/`@Kurzgesagt` → flux → 15 items → videoId + vignette) ;
  lecteur dans le navigateur (poster ytimg → clic → 1 iframe `nocookie` autoplay).
  Reste : parcours connecté complet (recherche → ajout → fil).

### Inscription en deux temps + onboarding ✅ (vérifié en local)

Refonte du flux d'inscription (cf. [ADR 0006](docs/decisions/0006-inscription-deux-temps-email.md)
+ [docs/inscription.md](docs/inscription.md)). On ne demande plus qu'**email +
mot de passe** au portail ; un **lien d'activation** par email ouvre un
**onboarding** où le profil (handle, nom, bio…) est choisi.

- **Tokenisé, sans demi-compte** : l'état pré-activation vit dans
  `pending_signups` (migration `0015`), **séparé de `users`** — `handle`,
  `display_name` et les clés AP y restent garantis non nuls. Le compte « réel »
  (ligne `users` + clés AP + session) naît seulement à la **fin de l'onboarding**
  (`finishOnboardingAction`). Jetons : seul le **hash SHA-256** est stocké
  (helpers purs `src/lib/tokens.ts`, partagés avec les sessions).
- **Email** : `src/lib/mail.ts` (nodemailer SMTP ; **transport « journal »** en
  console si `SMTP_HOST` vide → flux déroulable en local). Vars `SMTP_*`/`MAIL_FROM`.
- **Maintenance** : `runSignupMaintenance` (`src/lib/signups.ts`) → endpoint
  `/api/cron/signups` : rappel à 48 h (jeton tourné) puis suppression à 96 h des
  inscriptions **non cliquées**. Idempotent.
- **UI** : portail signup email+mdp + jauge de robustesse + écran « vérifiez vos
  mails » (`AuthCard`) ; connexion par **email *ou* handle** ; route plein écran
  `/bienvenue` (`src/components/onboarding/OnboardingWizard.tsx`) = **wizard
  5 étapes** fidèle au proto (Bienvenue/Profil/Ton fil/Paramétrage/C'est prêt) :
  niveau (cosmétique → info-bulles), identité (handle dispo en direct + avatar +
  bio + aperçu « vu de l'extérieur »), flux de départ (packs curatés + ajout
  libre), notifications, note `#introduction`.
- **Finalize étendu** (`src/lib/onboarding-finalize.ts`, best-effort) : avatar S3
  + `notification_settings` + abonnements (suivi local/distant, flux RSS/YouTube)
  + Note `#introduction` fédérée.
- **Packs curatés en admin** : `/admin/onboarding` (CRUD groupes + items
  marge/fediverse/rss/youtube → `onboarding_packs`/`onboarding_pack_items`,
  migration `0016`) — aucune donnée fictive ; le toggle « ordre du fil » du proto
  est retiré (fil chronologique seul).
- Vérifié : `tsc`/`lint`/`build` OK + `scripts/smoke-signup.ts`
  (`npx tsx --conditions=react-server …`) + **parcours navigateur complet**
  (admin crée pack « Écologie » {compte local + flux RSS} → signup → `/bienvenue`
  5 étapes → finalize : compte+clés, follow local *accepted*, abonnement RSS,
  Note `#introduction` publiée, `notification_settings` = realtime, fil peuplé).
  Reste : envoi SMTP réel + interop Mastodon via tunnel.

### Cron digest
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/digest`. À brancher
sur une tâche cron (quotidien par défaut, §4.3). Regroupe les signaux pauvres
(like/announce et tout type réglé sur `digest`) en notifications « N personnes… ».

### Cron RSS
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/poll`. À brancher
sur une vraie tâche cron en prod.

### Cron inscriptions
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/signups`. Maintenance
des inscriptions non activées (cf. [docs/inscription.md](docs/inscription.md) +
ADR 0006) : rappel à 48 h puis suppression à 96 h. Idempotent. Branché toutes les
heures dans `docker-compose.yml`.

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

## Conventions de documentation

La documentation publiée (MkDocs Material → GitHub Pages) vit dans `docs/`,
configurée par `mkdocs.yml`. **À lire avant toute tâche touchant à `docs/`.**

### Trois artefacts, à ne pas confondre

- `docs/cahier-des-charges/` — **état présent** du produit. Mutable. On le met à
  jour quand le périmètre change. (Les spécifications détaillées v0.1/v0.2
  restent dans `docs/cahier-des-charges*.md`, reliées depuis la synthèse.)
- `docs/decisions/` — **journal de décisions (ADR)**. Le *pourquoi*. Append-only.
- `docs/roadmap.md` — **futur**. Synthèse des phases ; le détail vit sur GitHub
  Projects.

### Rituel de capture (important)

À la **fin de toute discussion qui aboutit à une décision de conception**
structurante (interaction, fédération, droits sur les flux, modèle de données,
algorithme de feed, etc.) :

1. Proposer de rédiger un ADR.
2. Si validé, créer le fichier à partir de `docs/decisions/template.md`.
3. Le numéroter à la suite : `NNNN-titre-en-kebab.md` (4 chiffres).
4. L'ajouter **au tableau** de `docs/decisions/index.md` **et** à la `nav` de
   `mkdocs.yml`.
5. Un « arbitrage résiduel » non tranché → ADR au statut `Proposé` (ne pas le
   laisser uniquement dans un fil de discussion).

### Règles ADR

- Format **MADR** : Statut, Date, Contexte, Options envisagées, Décision,
  Conséquences.
- **Append-only.** On ne réécrit pas un ADR accepté. Pour revenir sur une
  décision : créer un nouvel ADR, et passer l'ancien au statut
  `Remplacé par 00XX`.
- Relier les ADR entre eux (champ « ADR liés ») plutôt que dupliquer le
  raisonnement.
- Toute modification de `docs/` passe par une **pull request** relue (provenance
  et traçabilité — exigence de gouvernance du projet).

### Publication

- Build local : `pip install -r requirements-docs.txt && mkdocs serve`.
- Le `push` sur `main` (modifiant `docs/**`, `mkdocs.yml` ou
  `requirements-docs.txt`) déclenche le déploiement GitHub Pages
  (`.github/workflows/deploy-docs.yml`). Le build est en `--strict` : un lien
  cassé ou une page hors `nav` fait échouer le déploiement.
