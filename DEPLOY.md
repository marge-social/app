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
