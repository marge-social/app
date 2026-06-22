# Inscription

L'inscription à marge se fait **en deux temps** : on ne demande d'abord qu'un
**email** et un **mot de passe**, puis un **lien d'activation** envoyé par email
ouvre un **onboarding** où l'on configure son profil (handle, nom, bio…). Le
compte « réel » ne naît qu'à la fin de l'onboarding.

Le *pourquoi* de ce choix est consigné dans
l'[ADR 0006](decisions/0006-inscription-deux-temps-email.md). Cette page décrit
le *comment*.

## Vue d'ensemble

```
1. Portail        →  email + mot de passe
                     (aucun compte créé, aucune session)
        │
        ▼
2. Email          →  lien d'activation /bienvenue?token=…
   d'activation      (jeton à usage unique, valable 96 h)
        │
        ▼
3. Onboarding     →  5 étapes : profil (handle/nom/avatar/bio),
   (/bienvenue)      flux de départ, notifications, présentation
        │
        ▼
4. Compte créé    →  ligne `users` complète (handle + clés ActivityPub),
                     session ouverte, redirection vers le fil.
```

Tant que le lien n'est **jamais cliqué**, une maintenance automatique envoie un
**rappel à 48 h** puis **supprime** l'inscription à **96 h**.

## Étape 1 — Inscription (email + mot de passe)

- Formulaire du **portail visiteur** (carte d'authentification, onglet « Créer
  un compte ») et page `/signup`. Seuls deux champs : email + mot de passe, avec
  une **jauge de robustesse** discrète (jamais bloquante : le minimum reste 8
  caractères).
- Server action `signupAction` (`src/app/actions/auth.ts`) :
  - valide l'email + le mot de passe ;
  - **réponse neutre** : on renvoie toujours « email envoyé » pour une saisie
    valide, sans révéler si l'adresse est déjà rattachée à un compte
    (anti-énumération, cohérent avec le message générique de la connexion) ;
  - pour une adresse libre : hache le mot de passe (argon2id) et crée une
    **inscription en attente** (`createPendingSignup`), ce qui envoie l'email.

Aucune session n'est ouverte, **aucune ligne `users` n'est créée** à cette étape.

### La table `pending_signups`

L'état pré-activation vit dans une table **séparée de `users`**
(`src/db/schema.ts`) :

| colonne            | rôle                                                            |
| ------------------ | --------------------------------------------------------------- |
| `email`            | unique ; vérifié contre `users` **et** `pending_signups`        |
| `password_hash`    | argon2id (même protection que `users`)                          |
| `token_hash`       | **hash SHA-256** du jeton ; le jeton brut n'existe que dans le lien |
| `locale`           | langue choisie à l'inscription (email + onboarding)             |
| `verified_at`      | posé au **premier clic** sur le lien (preuve de contrôle email) |
| `reminder_sent_at` | posé après l'envoi du rappel à 48 h (évite les doublons)        |
| `created_at`       | référence des échéances 48 h / 96 h                             |

Garder cet état hors de `users` évite tout **demi-compte** : `handle`,
`display_name` et les clés ActivityPub y restent **non nuls et garantis**, ce
dont dépend tout le code de fédération qui résout un acteur par son handle.

## Étape 2 — Email d'activation

- `src/lib/mail.ts` — couche d'envoi unique. Transport **SMTP via nodemailer**,
  configuré par les variables `SMTP_*` / `MAIL_FROM`.
- **En développement**, si `SMTP_HOST` n'est pas défini, on bascule sur un
  transport **« journal »** : l'email n'est pas envoyé, mais l'objet et surtout
  le **lien d'activation** sont écrits dans la console du serveur. On peut ainsi
  dérouler tout le flux en local sans serveur mail.
- Le lien pointe vers `/bienvenue?token=<jeton brut>`. Le jeton brut n'est jamais
  stocké : seul son hash l'est.

## Étape 3 — Onboarding (`/bienvenue`)

- Route plein écran, **hors du chrome de l'application** (comme le portail).
- Au chargement (`src/app/bienvenue/page.tsx`) : on résout l'inscription par le
  jeton (`findPendingByToken`). Jeton inconnu/expiré → écran « lien invalide ».
  Sinon on pose `verified_at` (`markPendingVerified`) — l'inscription échappe
  alors à la suppression à 96 h, et le lien **reste rejouable** pour reprendre un
  onboarding interrompu.
- Le wizard (`src/components/onboarding/OnboardingWizard.tsx`) est un assistant
  **en 5 étapes** à progression honnête (retour libre, aucun faux compte à
  rebours) :

  1. **Bienvenue** — auto-positionnement (débutant / initié) ; n'ajuste que le
     niveau de détail des info-bulles (cosmétique, rien n'est stocké).
  2. **Profil** — **handle** (disponibilité en direct via
     `checkHandleAvailabilityAction`, qui ne réserve rien), **nom**, **avatar**
     (photo ou pastille de couleur) et **bio**, avec un aperçu vivant « vu de
     l'extérieur » (rendu façon Mastodon).
  3. **Ton fil** — sélection de **packs de départ** (curatés en admin, cf.
     ci-dessous) + barre d'ajout libre (compte fédéré, flux RSS, chaîne
     YouTube). Aperçu du fil qui se remplit.
  4. **Paramétrage** — réglage des **notifications** (résumé quotidien → digest,
     temps réel → realtime, aucune → off).
  5. **C'est prêt** — note de présentation `#introduction` facultative.

### Finalisation des extras

À la finalisation (`finishOnboardingAction` → `applyOnboardingExtras`,
`src/lib/onboarding-finalize.ts`), après la création du compte, on applique —
**en best-effort**, chaque échec isolé n'empêchant jamais l'entrée dans marge :

- l'**avatar** (validé/ré-encodé/EXIF purgé, stocké S3) ;
- la **préférence de notifications** sur les 4 types interactifs ;
- les **abonnements** : compte local → suivi interne ; compte fédéré →
  `followRemoteActor` ; flux RSS/YouTube → référencement + abonnement ;
- la **note `#introduction`** (publiée + fédérée aux abonnés).

### Packs de départ (curation admin)

Les packs proposés à l'étape « Ton fil » sont **curatés en admin** —
**aucune donnée fictive** : `/admin/onboarding` permet de créer des **groupes**
(`onboarding_packs`) contenant des **comptes ou des flux réels**
(`onboarding_pack_items` : type `marge`/`fediverse`/`rss`/`youtube` + libellé +
référence). Un pack désactivé n'apparaît pas à l'inscription. Sélectionner un
pack au wizard abonne réellement la personne à tous ses items à la finalisation.

## Étape 4 — Finalisation

Server action `finishOnboardingAction` (`src/app/actions/onboarding.ts`), seul
point où un compte « réel » naît :

1. revalide le jeton et le profil (handle réservé ? déjà pris ?) ;
2. génère la paire de clés de l'acteur ActivityPub ;
3. **crée la ligne `users`** (handle + nom + bio + clés) ;
4. **supprime** l'inscription en attente ;
5. ouvre la **session** et redirige vers le fil.

La contrainte d'unicité sur `handle` tranche toute course concurrente.

## Maintenance — rappel 48 h / suppression 96 h

`runSignupMaintenance` (`src/lib/signups.ts`), exposée par l'endpoint cron
**`/api/cron/signups`** (protégé par `CRON_SECRET`, comme les autres endpoints
cron) :

1. **supprime** les inscriptions jamais activées (`verified_at` nul) au-delà de
   **96 h** ;
2. envoie un **rappel** à celles bloquées depuis **48 à 96 h** sans rappel déjà
   émis. Le rappel **fait tourner un nouveau jeton** (on ne stocke que le hash,
   donc on ne peut pas reconstruire le lien d'origine : on en émet un neuf).

L'opération est **idempotente** : la rejouer ne renvoie pas de rappel en double
et ne supprime rien deux fois.

Déclenchement :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/signups
```

En production, le service `cron` du `docker-compose.yml` l'appelle une fois par
heure (granularité largement suffisante pour des échéances de 48 h / 96 h).

## Configuration

Variables d'environnement (cf. `.env.example` / `.env.production.example`) :

| variable      | rôle                                                          |
| ------------- | ------------------------------------------------------------ |
| `SMTP_HOST`   | hôte SMTP. **Vide en dev** = transport journal (console).    |
| `SMTP_PORT`   | port (défaut `587`).                                         |
| `SMTP_SECURE` | `true` ⇒ TLS implicite (465) ; `false` ⇒ STARTTLS (587/25).  |
| `SMTP_USER`   | identifiant SMTP (optionnel si relai sans auth).             |
| `SMTP_PASS`   | mot de passe SMTP.                                           |
| `MAIL_FROM`   | adresse d'expéditeur, ex. `marge <no-reply@marge.social>`.   |
| `CRON_SECRET` | protège `/api/cron/signups` (et les autres endpoints cron).  |

!!! warning "Production"
    Sans `SMTP_HOST`, **aucun email d'activation n'est envoyé** : les
    inscriptions ne peuvent pas être finalisées. Le transport journal est réservé
    au développement local.

## Connexion

La connexion accepte désormais un **email ou un handle** (champ « Email ou
handle » du portail). Le message d'erreur reste **générique** pour ne pas révéler
l'existence d'un compte.

### Compte inscrit mais jamais activé

Une personne peut s'être inscrite sans avoir cliqué sur le lien d'activation : il
n'existe alors **aucune ligne `users`**, seulement une ligne `pending_signups`.
Plutôt que de renvoyer l'erreur générique (qui laisserait croire à un mauvais mot
de passe), `loginAction` (`src/app/actions/auth.ts`) :

1. ne trouvant pas de compte activé, cherche une inscription en attente par email
   (`findPendingByEmail`) ;
2. **vérifie d'abord le mot de passe** contre `pending_signups.password_hash` —
   un mot de passe erroné retombe sur le message générique (l'existence du compte
   en attente n'est révélée qu'à qui détient déjà les identifiants :
   **anti-énumération** préservé) ;
3. si le mot de passe est bon, **renvoie un email d'activation** (`resendActivation`
   : nouveau jeton, l'ancien est invalidé puisqu'on ne stocke que le hash) et
   affiche un écran dédié « Votre compte n'est pas encore activé ».

Aucune session n'est ouverte et aucun compte n'est créé : on reste dans le flux
tokenisé, l'utilisateur n'a qu'à rouvrir le lien reçu pour reprendre l'onboarding.

## Sécurité — points clés

- Jetons d'activation **à usage unique**, dont seul le **hash SHA-256** est
  stocké (même principe que les jetons de session).
- Mots de passe hachés en **argon2id**, y compris dans `pending_signups`.
- **Anti-énumération** : l'inscription et la connexion renvoient des réponses
  neutres.
- Le clic sur le lien constitue la **preuve de contrôle de l'adresse email**
  avant qu'un compte fédéré n'existe.
