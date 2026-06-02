# Marge — Cahier des charges fonctionnel du MVP

> Document de spécification destiné à piloter le développement avec Claude Code.
> Version 0.4 — à itérer.

---

## 1. Contexte et vision

**Marge** est un média social de contenus longs, sourcés et argumentés, conçu à
contre-courant de l'économie attentionnelle. Il s'inscrit dans une vision de
**numérique d'intérêt général** : interopérabilité par les standards ouverts,
souveraineté des données, accessibilité, absence de dark patterns.

Le présent document spécifie le **MVP**, dont l'ambition est volontairement
resserrée : démontrer trois choses, et seulement trois.

1. **J'agrège** — un compte peut déclarer ses flux RSS, et chacun peut être
   suivi indépendamment du compte ; les items suivis se lisent dans Marge.
2. **Je publie** — je peux écrire et publier des textes sur la plateforme.
3. **C'est décentralisé** — mes textes sont nativement fédérés (ActivityPub) et
   suivables depuis le Fediverse (Mastodon et autres).

Tout le reste de la vision Marge (index de réputation, algorithme paramétrable
transparent, annotations marginales, réponses-billets, friction temporelle)
est **explicitement hors périmètre** du MVP. Voir §10.

---

## 2. Partis pris d'architecture (décisions actées)

| Décision | Choix retenu | Implication |
|---|---|---|
| Rôle du RSS | **Flux déclaré par un compte, suivable séparément** | Un compte déclare ses flux ; chaque flux est un objet suivable distinct du compte. Interne uniquement : le contenu RSS ne ressort **jamais** vers le Fediverse. |
| Follow de compte vs follow de flux | **Indépendants** | Suivre un auteur n'abonne pas à ses flux. Levier de maîtrise de la diffusion par l'auteur. |
| Degré de fédération | **Fédéré nativement dès le MVP** | Chaque auteur Marge est un acteur ActivityPub suivable depuis Mastodon. |
| Modèle d'instance | **Multi-comptes** | Une instance Marge héberge plusieurs auteurs, chacun avec sa propre identité fédérée. |
| Type d'objet publié | **`Article`** (format long) | Fidèle au positionnement. Stratégie de dégradation gracieuse côté Mastodon (résumé + permalien). |
| Tri du feed | **Chronologique pur** | Pas d'algorithme dans le MVP. Position assumée, pas un manque. |

### Deux objets suivables, deux follows indépendants

Marge distingue **deux types d'objets suivables**, chacun avec son propre
bouton « Suivre ». Ils ne sont jamais couplés : suivre un compte n'abonne pas
à ses flux, et inversement.

| Objet suivable | Ce qu'on reçoit en le suivant | Nature | Portée du follow |
|---|---|---|---|
| **Compte** (acteur AP) | Les textes natifs Marge (`Article`) de l'auteur | ActivityPub | Interne **et** fédéré (suivable depuis Mastodon) |
| **Flux RSS** (déclaré par un compte) | Les items du flux externe de l'auteur | RSS, interne | Interne uniquement (ne fédère pas) |

Un compte peut déclarer **zéro, un ou plusieurs** flux. C'est le levier de
**maîtrise de la diffusion** : un auteur sépare ses essais natifs Marge de ses
billets de blog crosspostés, et laisse chaque lecteur choisir ses canaux.

### Architecture des flux

```
  ENTRANTS (surface de lecture unifiée, chronologique)
  ├── Articles des COMPTES suivis (auteurs Marge)     [ActivityPub, interne]
  ├── Contenus des COMPTES Fediverse distants suivis  [ActivityPub, fédéré]
  └── Items des FLUX RSS suivis (déclarés par un compte) [interne, ne ressort jamais]

  SORTANT
  └── Textes publiés par les auteurs Marge → fédèrent vers le Fediverse
      (les items RSS ne sortent jamais)
```

---

## 3. Stack technique recommandée

Choix orienté « développement assisté par Claude Code » : un seul langage, un
seul dépôt, et une bibliothèque qui absorbe la complexité du protocole.

- **Langage** : TypeScript, de bout en bout.
- **Framework web** : Hono (léger) ou Next.js (si SSR/front intégré souhaité).
- **Fédération** : **Fedify** — framework ActivityPub qui gère WebFinger, les
  signatures HTTP, les paires de clés, l'inbox/outbox et l'interopérabilité
  Mastodon. C'est le « Rails du Fediverse » ; Ghost et Typo Blue l'utilisent en
  production. Un *skill* Fedify avec documentation optimisée pour LLM existe et
  facilite le travail avec Claude Code.
- **Base de données** : PostgreSQL.
- **ORM** : Drizzle.
- **Cache / file d'attente** : requis par Fedify pour le cache et la livraison
  sortante. Redis recommandé ; un adaptateur Postgres suffit pour démarrer.
- **Parsing RSS** : une bibliothèque éprouvée (ex. `rss-parser` / `feedparser`).
- **Planificateur** : tâche cron pour le polling RSS périodique.

> Note : ces choix sont des recommandations, pas des contraintes. Toute
> substitution est acceptable tant que (a) Fedify ou un équivalent gère la
> fédération, et (b) la portabilité des données est préservée.

---

## 4. Modèle de données (entités principales)

- **User** — compte authentifié. Champs : id, email, mot de passe (haché),
  handle (unique sur l'instance), nom affiché, bio, date de création.
- **Actor** — projection ActivityPub d'un User (peut être fusionnée avec User au
  MVP). Champs : URI de l'acteur, clé publique/privée, inbox, outbox, followers.
- **Article** — texte publié. Champs : id, auteur (User), titre, contenu
  (Markdown source + HTML rendu), résumé, slug/permalien, statut
  (brouillon/publié), date de publication, URI ActivityPub.
- **Feed** — flux RSS référencé sur Marge. Il a un **statut de propriété** :
  `orphelin` (référencé par un utilisateur, sans propriétaire), `réclamé`
  (rattaché à un compte vérifié) ou `opt-out` (refusé, dé-référencé). Champs : id,
  propriétaire (User, **nullable** — null si orphelin), URL du flux, titre,
  description, statut de propriété, statut technique (actif / en erreur),
  référencé-par (User à l'origine du référencement, pour audit), texte intégral
  autorisé (booléen, faux par défaut, activable seulement par un propriétaire),
  dates. Un User peut posséder 0..n Feed.
- **FeedItem** — item récupéré d'un Feed. Champs : id, feed, GUID (dé-doublonnage),
  titre, lien, auteur, contenu/extrait, date de publication. Récupéré **une seule
  fois** par flux, puis redistribué à tous les abonnés du flux. Pour un flux
  orphelin, seul l'**extrait** est stocké/affiché (voir F3).
- **FeedSubscription** — abonnement d'un User à un Feed. Relation **interne**
  (≠ Follow ActivityPub). Champs : abonné (User), flux (Feed), date.
- **FeedClaim** — demande de réclamation OU d'opt-out d'un flux, avec preuve de
  contrôle. Champs : flux, demandeur, type (réclamation / opt-out), méthode de
  vérification, jeton, statut (en attente / vérifié / rejeté), dates.
- **Blocklist** — URLs/domaines de flux ayant fait l'objet d'un opt-out vérifié.
  Vérifiée à chaque tentative de référencement d'un nouveau flux.
- **Follow** — relation de suivi **ActivityPub** entre acteurs (≠ FeedSubscription).
  Cible un acteur (compte local ou distant), jamais un flux. Champs : acteur
  suivant (local ou distant), acteur suivi (local ou distant), statut (en
  attente / accepté), date.
- **RemoteActor** — cache des acteurs distants suivis (handle, URI, inbox, nom).

---

## 5. Spécifications fonctionnelles

### F1 — Comptes et identité fédérée

- Inscription par email + mot de passe ; sessions sécurisées.
- À la création d'un compte, génération automatique d'une **paire de clés** et
  d'un **acteur ActivityPub** (`Person`) avec un handle de la forme
  `@handle@instance.tld`.
- Page de profil publique exposant : nom, bio, liste des textes publiés natifs,
  un bouton **« Suivre le compte »** (fédéré), et la liste des **flux RSS
  déclarés** par l'auteur, chacun avec son propre bouton **« Suivre ce flux »**
  (interne). Les deux gestes de suivi sont visuellement distincts et jamais
  couplés.
- **Déclaration de flux par un propriétaire** : depuis ses réglages, un auteur
  peut rattacher 0..n flux RSS à son compte. Comme c'est une **assertion de
  propriété**, elle passe par la même **vérification de contrôle** que la
  réclamation (voir F3) — sinon on pourrait s'approprier le flux d'autrui. Une
  fois vérifié, le flux est en statut « réclamé » et l'auteur peut le nommer,
  l'éditer, activer le texte intégral, le retirer.
- Endpoint **WebFinger** (`/.well-known/webfinger`) résolvant les handles —
  géré par Fedify.

### F2 — Publication de textes

- Éditeur simple : titre + corps en **Markdown**, prévisualisation, brouillon /
  publier. (Textes simples au MVP — pas d'outillage de sourcing/annotation.)
- À la publication :
  1. Rendu Markdown → HTML, stockage, génération d'un permalien stable.
  2. Création d'un objet ActivityPub **`Article`** (titre = `name`, HTML =
     `content`, `summary` = résumé/chapô, `url` = permalien, `attributedTo` =
     acteur auteur).
  3. Émission d'un `Create(Article)` vers les inboxes des followers via Fedify.
- **Dégradation gracieuse côté Mastodon** : comme Mastodon tronque les `Article`,
  prévoir un `summary` soigné + le permalien Marge bien visible.
- Édition / suppression d'un texte → émission des activités `Update` / `Delete`
  correspondantes.

### F3 — Flux RSS : référencement, suivi, réclamation, opt-out (interne)

**Modèle « permissionless mais contestable »** : un flux peut être référencé sur
Marge sans l'accord préalable de son auteur (c'est l'esprit de la syndication
RSS), mais l'auteur garde à tout moment la main — il peut le réclamer ou le
refuser. Un flux a un **statut de propriété** : orphelin, réclamé, ou opt-out.

**Référencement et cycle de vie**

- **Référencer un flux** : **tout utilisateur authentifié** peut référencer
  n'importe quel flux externe, **sans quota au MVP** (lutte anti-abus en V2).
  Un utilisateur ajoute une URL (flux ou page avec auto-découverte du
  `<link rel="alternate">`). Avant création, l'URL/le domaine est vérifié contre
  la **Blocklist** ; si bloqué, le référencement est refusé. Sinon, le flux est
  créé en statut **orphelin** (propriétaire = null) et devient suivable par tous.
- **Polling mutualisé** (cron), **une seule fois par flux** ; dé-doublonnage par
  GUID ; redistribution aux abonnés. Le *crawler* s'identifie via un `User-Agent`
  contenant un lien vers la **page publique de réclamation/opt-out** du flux —
  c'est ainsi qu'un blogueur découvre que son blog est référencé.
- **Affichage des orphelins** : **extrait + lien vers la source uniquement**,
  jamais le texte intégral réhébergé (respect éthique et limitation du risque
  droit d'auteur). Le texte intégral n'est possible que pour un flux réclamé dont
  le propriétaire l'a explicitement activé.

**Les trois choix offerts au blogueur** (sur la page publique du flux)

1. **Ne rien faire** → le flux reste orphelin et accessible.
2. **Réclamer la propriété** → l'auteur crée (ou relie) un compte Marge, prouve
   le contrôle du flux (voir Vérification), et le flux passe en **réclamé** :
   propriétaire renseigné, l'auteur peut l'éditer, activer le texte intégral, et
   il devient un flux déclaré comme en F1.
3. **Refuser (opt-out)** → après preuve de contrôle, le flux passe en **opt-out**,
   est **dé-référencé** (suppression du Feed, des FeedItem et des
   FeedSubscription) et son URL/domaine est ajouté à la **Blocklist** pour
   empêcher tout re-référencement.

**Vérification de contrôle** (commune à réclamation et opt-out)

- **Mécanisme MVP : jeton unique.** Marge génère un jeton que le blogueur insère
  une fois dans son flux (item ou balise dédiée) ou sur une page du blog ; Marge
  le récupère au polling et valide automatiquement. Universel (marche même sans
  support `rel="me"`) et simple à implémenter.
- En V2 : ajout de la vérification par lien `rel="me"` réciproque (IndieWeb).

**Suivi**

- Depuis le profil d'un auteur (flux réclamés) ou la fiche d'un flux (orphelin ou
  réclamé), un utilisateur peut suivre un flux. Ce suivi (FeedSubscription) est
  **indépendant** du suivi du compte propriétaire éventuel.

**Contrainte clé** : tout ceci reste **interne**. Un flux n'est pas un acteur
ActivityPub, n'est pas suivable depuis le Fediverse, et ses items ne sont jamais
ré-émis en ActivityPub.

### F4 — Fédération ActivityPub

- **Acteur** : chaque User est exposé comme acteur (`/users/:handle`), avec
  inbox, outbox, collection followers.
- **Suivre / être suivi** (le suivi cible toujours un **compte/acteur**, jamais
  un flux) :
  - **Interne** : un User Marge peut suivre un autre User Marge → relation Follow
    locale, `Accept` immédiat. C'est le cœur du « média social » : un compte
    s'abonne à un autre compte.
  - **Sortant** : un User Marge peut suivre un acteur distant (ex. compte
    Mastodon) → émission d'un `Follow`, traitement de l'`Accept`.
  - **Entrant** : un acteur distant peut suivre un User Marge → réception du
    `Follow` dans l'inbox, `Accept` automatique au MVP.
- **Réception (inbox)** : traiter au minimum `Follow`, `Undo(Follow)`,
  `Create(Note/Article)` (pour alimenter le feed), `Delete`, `Update`.
- **Émission (outbox)** : `Create(Article)` à la publication ; livraison aux
  followers gérée par la file d'attente Fedify.
- Signatures HTTP, JSON-LD, WebFinger : délégués à Fedify.

### F5 — Surface de lecture unifiée (le feed)

- Fil unique fusionnant les **trois sources entrantes** : Articles des **comptes
  Marge suivis**, contenus des **comptes Fediverse distants suivis**, et items
  des **flux RSS suivis**. (Suivre un compte et suivre un flux étant indépendants,
  un lecteur voit exactement les canaux qu'il a choisis.)
- **Tri chronologique strict** (du plus récent au plus ancien). Pas de score,
  pas de pondération, pas de ranking opaque.
- Chaque entrée affiche un **aperçu honnête** : titre, auteur/source, date,
  premier paragraphe ou extrait, et le cas échéant le temps de lecture estimé.
  Pas d'accroche-piège, pas de compteur d'engagement.
- Clic → lecture du texte complet (interne pour les Articles Marge ; lien
  sortant pour les items RSS et contenus distants).

---

## 6. Parcours utilisateur clés (user stories)

1. *En tant qu'auteure*, je crée un compte et j'obtiens un handle fédéré
   `@claire@marge.tld`.
2. *En tant qu'auteure*, je réclame le flux RSS de mon blog Wordpress en prouvant
   que je le contrôle ; il se rattache à mon compte.
3. *En tant que lecteur*, je référence sur Marge un blog externe qui n'a pas de
   compte ; il devient un flux orphelin que d'autres peuvent suivre (extrait +
   lien seulement).
4. *En tant que blogueur sans compte*, je découvre via le `User-Agent` du crawler
   que mon flux est référencé, et je choisis : ne rien faire, le réclamer, ou
   demander son retrait (opt-out).
5. *En tant que blogueur*, je fais un opt-out vérifié ; mon flux est dé-référencé
   et ne peut plus être ré-ajouté.
6. *En tant qu'auteure*, j'écris un texte en Markdown et je le publie ; il
   devient suivable depuis Mastodon.
7. *En tant qu'utilisateur Mastodon*, je suis `@claire@marge.tld` et je vois ses
   nouveaux textes natifs arriver dans mon fil Mastodon (mais pas son flux RSS).
8. *En tant que lecteur Marge*, sur le profil de Claire je peux suivre **son
   compte**, **son flux**, ou **les deux** — ce sont des gestes séparés.
9. *En tant que lecteur Marge*, je suis un autre compte Marge, un compte Mastodon
   et un flux RSS ; mon fil chronologique fusionne exactement ces canaux choisis.

---

## 7. Exigences non-fonctionnelles (alignées numérique d'intérêt général)

- **Portabilité des données** : export des textes (Markdown) et de la liste des
  abonnements (OPML pour le RSS) accessible à l'utilisateur.
- **Accessibilité** : conformité visée RGAA / WCAG AA (navigation clavier,
  contrastes, sémantique HTML).
- **Absence de dark patterns** : aucun compteur d'engagement public, aucune
  notification d'incitation au retour, aucun ranking opaque.
- **Vie privée / RGPD** : minimisation des données, consentement, suppression de
  compte effective (avec émission des `Delete` fédérés).
- **Standards ouverts** : Markdown (contenu), RSS/OPML (agrégation),
  ActivityPub (fédération).
- **Consentement des sources externes** : opt-out **simple et honoré sans délai**
  (dé-référencement + blocklist) ; affichage des flux orphelins en **extrait +
  lien** uniquement, jamais le texte intégral (respect du droit d'auteur). Le
  crawler s'identifie (`User-Agent` avec lien vers la page de réclamation/opt-out).
- **Modération minimale** : au MVP, possibilité de bloquer un acteur distant et
  de signaler ; modération avancée renvoyée en V2.

---

## 8. Découpage en lots pour Claude Code

Séquence de build proposée — chaque lot est livrable et testable seul.

1. **Lot 0 — Socle.** Repo TypeScript, Postgres + Drizzle, schéma de données,
   auth multi-comptes, page profil.
2. **Lot 1 — Publication interne.** Éditeur Markdown, publication, permaliens,
   rendu de lecture. (Pas encore de fédération.)
3. **Lot 2 — Fédération sortante.** Intégration Fedify : acteur, WebFinger,
   clés, outbox. Un `Article` publié devient suivable et livrable. Test : se
   faire suivre depuis un compte Mastodon de test et recevoir un texte.
4. **Lot 3 — Fédération entrante + follow interne.** Inbox : traiter `Follow`,
   `Create`. Follow compte-à-compte interne (Marge ↔ Marge). Suivre un acteur
   distant. Les contenus distants alimentent le feed.
5. **Lot 4 — Flux RSS : référencement + suivi.** Référencer un flux (statut
   orphelin), polling cron mutualisé, dé-doublonnage, affichage extrait + lien,
   suivi de flux (FeedSubscription, indépendant du follow de compte),
   redistribution aux abonnés.
6. **Lot 5 — Propriété des flux : réclamation + opt-out.** Page publique du flux,
   vérification de contrôle (`rel="me"` ou jeton), réclamation (→ flux réclamé,
   texte intégral activable), opt-out (→ dé-référencement + Blocklist),
   identification du crawler via `User-Agent`.
7. **Lot 6 — Feed unifié.** Fusion chronologique des trois sources + aperçus
   honnêtes. Export OPML / Markdown.

---

## 9. Critères d'acceptation du MVP

Le MVP est atteint quand, sur une instance déployée :

- [ ] Plusieurs comptes coexistent, chacun avec un handle fédéré valide
      (résolvable via WebFinger).
- [ ] Un texte publié sur Marge est visible et suivable depuis un compte
      Mastodon externe.
- [ ] Un utilisateur Marge peut suivre un autre compte Marge (follow interne) et
      voir ses textes dans son fil.
- [ ] Un utilisateur Marge peut suivre un compte Mastodon et en voir les
      contenus dans son fil.
- [ ] Un compte peut réclamer un flux après preuve de contrôle ; il en devient
      propriétaire et peut activer le texte intégral.
- [ ] Un blog externe sans compte peut être référencé comme flux orphelin,
      suivable par d'autres, affiché en **extrait + lien** seulement.
- [ ] Un opt-out vérifié dé-référence le flux et l'empêche d'être ré-ajouté
      (Blocklist).
- [ ] Un utilisateur peut suivre un flux indépendamment du compte qui le possède,
      et **suivre le compte n'abonne pas automatiquement à ses flux**.
- [ ] Les items d'un flux suivi apparaissent dans le fil de l'abonné.
- [ ] Le fil unique fusionne les sources suivies en ordre chronologique strict.
- [ ] Aucun compteur d'engagement public n'apparaît dans l'interface.
- [ ] L'utilisateur peut exporter ses textes (Markdown) et ses flux (OPML).

---

## 10. Hors périmètre (renvoyé en V2 et au-delà)

Pour éviter toute dérive de périmètre, les fonctionnalités suivantes — pourtant
au cœur de la vision Marge — sont **explicitement exclues du MVP** :

- Index de réputation décomposé.
- Algorithme de feed paramétrable et transparent (curseurs récence ↔ profondeur,
  etc.) ; le MVP reste chronologique.
- Annotations marginales (style Hypothes.is).
- Réponses-billets et logique de trackback.
- Friction temporelle anti-réaction-à-chaud.
- Formats différenciés (Note / Billet / Analyse).
- Modération avancée, recommandation, découverte éditoriale.
- **Notification proactive** des blogueurs dont le flux est référencé (au MVP, la
  découverte passe par le `User-Agent` du crawler ; le ping actif, type
  WebMention, est en V2).
- **Lutte anti-abus du référencement** : quotas par compte, réservation aux
  comptes vérifiés, détection de flux de spam/contenu problématique. Au MVP, le
  référencement orphelin reste ouvert et sans quota.

Ces briques pourront s'appuyer sur le socle fédéré du MVP sans le remettre en
cause.

---

## 11. Risques et points de vigilance

- **Interopérabilité Mastodon des `Article`** : à tester tôt (Lot 2). Prévoir le
  fallback résumé + permalien.
- **Livraison fédérée** : la file d'attente sortante (retries, instances lentes)
  est un point sensible ; s'appuyer sur les mécanismes Fedify plutôt que de les
  réimplémenter.
- **Polling RSS à l'échelle** : trivial au MVP, à surveiller si le nombre
  d'abonnements croît (intervalles adaptatifs en V2).
- **Sécurité des clés** : stockage chiffré des clés privées des acteurs.
- **Usurpation / sabotage de flux** : sans vérification de contrôle, on pourrait
  réclamer le flux d'autrui ou dé-référencer celui d'un tiers. La preuve de
  contrôle (F3) est donc non-négociable sur les chemins réclamation et opt-out.
- **Droit d'auteur des flux orphelins** : s'en tenir à extrait + lien atténue le
  risque ; le texte intégral reste réservé aux flux réclamés et opt-in.
- **Référencement ouvert (choix MVP assumé)** : sans quota ni filtrage, la base de
  flux à *poller* peut grossir vite et accueillir du spam. Risque accepté pour le
  MVP ; mitigations (quotas, comptes vérifiés, détection) prévues en V2.
