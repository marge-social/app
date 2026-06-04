# Déploiement (VPS + Docker + Caddy)

Stack de déploiement : un seul VPS exécute l'app Next.js (avec le worker de
livraison fédérée _in-process_), PostgreSQL, Caddy (HTTPS automatique) et un
cron de polling RSS — le tout orchestré par `docker compose`.

## Prérequis

- Un VPS Linux (1–2 Go RAM suffisent), Docker + plugin Compose installés.
- Un **domaine** dont un enregistrement DNS **A** pointe vers l'IP du VPS.
  ⚠️ Ce domaine est définitif : les identités fédérées en dépendent.

## 1. Première mise en route

```bash
# Sur le VPS
git clone <url-du-dépôt> /opt/marge
cd /opt/marge
cp .env.production.example .env
# Génère les secrets :
openssl rand -hex 32   # → KEY_ENCRYPTION_SECRET
openssl rand -hex 32   # → CRON_SECRET
nano .env              # renseigne DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD,
                       # DATABASE_URL, APP_URL, INSTANCE_DOMAIN, les 2 secrets

docker compose up -d --build
```

Caddy obtient le certificat TLS automatiquement. L'app est en ligne sur
`https://<DOMAIN>`. Le service `migrate` applique les migrations avant le
démarrage de l'app ; le worker de livraison démarre avec l'app.

```bash
docker compose logs -f app      # suivre l'app
docker compose ps               # état des services
```

## 2. Test d'interopérabilité Mastodon

Une fois en HTTPS sur le domaine définitif : crée un compte, publie un texte,
puis depuis un compte Mastodon cherche `@<handle>@<DOMAIN>`, suis-le et vérifie
l'arrivée du texte (résumé + permalien).

## 2 bis. Amorçage du premier administrateur

Aucun compte n'est admin au départ. Pour promouvoir le premier (qui pourra
ensuite accéder aux vues `/admin/*` en lecture seule), exécute le script CLI
dédié dans le conteneur `app`, en lui passant le **nom d'utilisateur** (handle) :

```bash
docker compose exec app node scripts/make-admin.mjs karl
# ✓ @karl est désormais admin.
```

Le script bascule `role=admin` sur le compte ciblé. Réversible en base si besoin
(`UPDATE users SET role='user' WHERE handle='karl';`). C'est l'**unique** voie
d'amorçage : pas de variable d'environnement, pas d'auto-promotion.

## 2 ter. Stockage des médias (OVH Object Storage)

Les médias (pièces jointes des posts/billets, avatars) sont stockés sur un
bucket S3 OVH et servis depuis un **sous-domaine dédié** `media.<DOMAIN>`. Rien
n'atterrit sur le disque du VPS.

1. **Créer le bucket** (OVH Object Storage, région ex. GRA) — ex. `marge-media`.
   Générer une **clé d'accès S3** (access key + secret) avec droits d'écriture.
2. **Lecture publique** : sur la région GRA, les *bucket policies* ne sont pas
   disponibles (`PutBucketPolicy` → `NotImplemented`). L'app pose donc l'ACL
   **`public-read`** **et** le `Content-Type` validé sur chaque `PutObject`
   (déjà fait dans le code) — rien à configurer côté bucket. CORS inutile (les
   médias sont servis via de simples `<img>`/`<video>`, pas d'accès navigateur
   direct au bucket).
3. **DNS** : créer un enregistrement `media` (A → IP du VPS), de sorte que
   `media.<DOMAIN>` résolve vers le VPS. Caddy (bloc `{$MEDIA_DOMAIN}` du
   `Caddyfile`) *reverse-proxy* ce sous-domaine vers le bucket en réécrivant
   l'en-tête `Host` (HTTPS auto Let's Encrypt).
4. **Variables `.env`** (cf. `.env.production.example`) :
   - `MEDIA_DOMAIN` (ex. `media.marge.exemple.org`) — vu par Caddy.
   - `MEDIA_BUCKET_HOST` (ex. `marge-media.s3.gra.io.cloud.ovh.net`) — hôte S3 du
     bucket vers lequel Caddy proxifie.
   - `MEDIA_BASE_URL` (ex. `https://media.marge.exemple.org`) — vu par l'app pour
     construire les URL publiques des médias.
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.

> Limite de 5 Mo/fichier (validée côté serveur **et** plafonnée par Caddy via
> `request_body max_size 6MB`). Les images sont re-encodées et leurs métadonnées
> EXIF purgées ; les PDF sont servis en téléchargement (`Content-Disposition`).
> La migration `media` (table + `users.avatar_media_id`) est appliquée
> automatiquement par le conteneur `migrate`.

## 3. Déploiement des commits suivants (auto via GitHub Actions)

À chaque `push` sur `main`, le workflow `.github/workflows/deploy.yml` :
1. **vérifie** le code (lint, typecheck, `next build`) — bloque si échec ;
2. se connecte en **SSH** au VPS et joue `git pull` + `docker compose up -d
   --build` (les migrations Drizzle sont rejouées par le service `migrate`).

Secrets à définir dans le dépôt GitHub (_Settings → Secrets and variables →
Actions_) :

| Secret | Valeur |
|---|---|
| `DEPLOY_HOST` | IP ou hostname du VPS |
| `DEPLOY_USER` | utilisateur SSH (membre du groupe `docker`) |
| `DEPLOY_SSH_KEY` | clé privée SSH autorisée sur le VPS |
| `DEPLOY_PATH` | chemin du dépôt sur le VPS (ex. `/opt/marge`) |

Déploiement manuel possible à tout moment : `docker compose up -d --build`.

## 4. Sauvegardes (à faire dès le départ)

Les clés privées des acteurs vivent dans Postgres :

```bash
docker compose exec db pg_dump -U marge marge > backup-$(date +%F).sql
```

## Notes d'exploitation

- **Mono-instance** : le worker de livraison tourne dans le process de l'app.
  Pour scaler horizontalement, la `PostgresMessageQueue` gère le verrouillage
  (plusieurs workers restent sûrs), mais une seule instance suffit ici.
- **Ne change jamais** `KEY_ENCRYPTION_SECRET` ni le domaine après le premier
  compte créé / la première fédération.
- Montée en charge RSS : ajuster l'intervalle du service `cron` (900 s par
  défaut) dans `docker-compose.yml`.
- Migration vers une file Redis : remplaçable plus tard sans toucher au
  domaine métier (l'adaptateur Postgres suffit pour démarrer).
