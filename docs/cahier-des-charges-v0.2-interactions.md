# marge — Cahier des charges fonctionnel du MVP

## Module : Interactions sociales & Notifications

> Extension du cahier des charges v0.1 (agrégation RSS + publication + fédération).
> Version 0.2 — à itérer.
> Document de spécification destiné à piloter le développement avec Claude Code.

---

## 1. Périmètre et principe directeur

Ce module ajoute la **boucle sociale** de marge : réagir, répondre, amplifier, et
être informé de ces réactions — en local comme en fédéré.

Le principe directeur, hérité du positionnement anti-attentionnel du projet, est
le suivant :

> **Le réseau parle normalement au Fediverse ; c'est l'utilisateur qui décide de
> ce qui mérite de l'interrompre.**

Conséquence : on n'ampute aucune fonction native d'ActivityPub (les signaux
existent et fédèrent de façon standard), mais le travail éthique est déplacé du
*geste* vers sa *réception*. La granularité des notifications est le levier, pas
la suppression des fonctionnalités.

---

## 2. Les quatre primitives d'interaction

Trois verbes demandés, mais quatre objets, car « commenter » se dédouble.

| Interaction | Geste utilisateur | Activité ActivityPub | Objet | Placement dans marge |
|---|---|---|---|---|
| **Like** | 1 clic | `Like` | — | Sous le contenu, discret |
| **Commentaire court** | Champ texte bref | `Create` | `Note` + `inReplyTo` | Fil sous le contenu |
| **Réponse-billet** | Éditeur complet | `Create` | `Article` + `inReplyTo` | Remonte dans le feed comme publication |
| **Partage** | 1 clic | `Announce` | — | Réémission dans le feed des abonnés |

### 2.1 Like
- Émet une activité `Like` ciblant l'objet (`object` = IRI du contenu) vers
  l'inbox de l'auteur et, en fédéré, vers son instance.
- **Annulation** : émettre un `Undo` enveloppant le `Like` initial. L'UI bascule
  l'état (toggle), elle ne crée pas un second `Like`.
- Idempotence : un même acteur ne peut liker qu'une fois un même objet ; le
  back-end déduplique sur le couple `(actor, object)`.

### 2.2 Commentaire court
- `Create` d'une `Note` dont `inReplyTo` pointe l'objet d'origine.
- Affiché en fil **sous** le contenu (logique de discussion threadée).
- Limite de longueur à fixer (suggestion : 500 caractères) pour le distinguer
  nettement de la réponse-billet.
- Reçu d'un acteur distant (Mastodon, etc.) : s'affiche dans le même fil.

### 2.3 Réponse-billet
- `Create` d'un `Article` (ou `Note` longue) avec `inReplyTo`.
- **Double existence** : il apparaît à la fois (a) comme publication autonome
  dans le feed/profil de son auteur et (b) rattaché au contenu d'origine via le
  lien `inReplyTo`. C'est la « réponse comme billet lié » du cahier de design.
- C'est l'interaction la plus coûteuse et la plus valorisée : elle structure le
  débat plutôt que le commentaire de réaction.

### 2.4 Partage
- Émet un `Announce` ciblant l'objet ; les abonnés de l'acteur qui partage
  reçoivent l'objet réémis dans leur inbox.
- **Annulation** : `Undo` du `Announce`.
- Décision de design (cf. §6) : un partage transmet le contenu **tel quel**, sans
  surcouche d'amplification (pas de « tendances », pas de classement par nombre
  de partages).

---

## 3. Modèle de données (incrément)

Tables / collections à ajouter ou étendre :

- `interactions` — journal des activités reçues et émises
  - `id`, `type` (`Like` | `Announce` | `Reply` | `Comment`)
  - `actor_iri` (local ou distant), `object_iri` (le contenu visé)
  - `origin` (`local` | `federated`)
  - `created_at`, `undone_at` (nullable, pour Like/Announce annulés)
- `objects` (existant) — étendu pour porter le compte des réponses/commentaires
  rattachés via `inReplyTo` (compte interne, voir §6 sur l'affichage).
- `notifications` — voir §4.
- `notification_settings` — préférences par utilisateur, voir §4.2.

Note interop : on stocke systématiquement l'**IRI** de l'acteur et de l'objet,
jamais une clé locale seule, pour traiter local et fédéré de façon homogène.

---

## 4. Système de notifications

### 4.1 Origine des notifications
Une notification est **dérivée de l'inbox** de l'acteur. Toute activité entrante
ciblant un de ses contenus est candidate :

- `Like` reçu → notification « like »
- `Announce` reçu → notification « partage »
- `Create`/`Note` avec `inReplyTo` sur son contenu → notification « commentaire »
- `Create`/`Article` avec `inReplyTo` sur son contenu → notification « réponse »

Le traitement est **identique que l'activité soit locale ou fédérée** : le
même pipeline d'inbox les produit. Le champ `origin` permet seulement de filtrer
ou d'étiqueter, pas de coder deux chemins distincts.

### 4.2 Granularité réglable (cœur du module)

Chaque utilisateur dispose d'une **matrice de préférences**. Pour chacun des
quatre types d'interaction, il règle :

1. **Canal de remise** : `temps réel` | `digest` | `désactivé`
2. **Portée** : `local + fédéré` | `local seulement` | `fédéré seulement`

Optionnellement (V2 possible) : seuils (« ne me notifier qu'à partir de N
réactions »), mise en sourdine par contenu (`mute thread`), plages horaires.

### 4.3 Valeurs par défaut (calm by default)

Le défaut traduit l'éthique du projet : **l'interaction coûteuse interrompt, le
signal pauvre s'accumule en silence**.

| Type | Canal par défaut | Portée par défaut |
|---|---|---|
| Réponse-billet | Temps réel | Local + fédéré |
| Commentaire court | Temps réel | Local + fédéré |
| Partage | Digest | Local + fédéré |
| Like | Digest | Local + fédéré |

Le digest est un récapitulatif périodique (par défaut : quotidien) groupant les
signaux pauvres, pour ne jamais déclencher d'interruption au coup par coup.

### 4.4 Modèle de la notification
- États : `non lu` / `lu`. Pas de compteur cumulatif anxiogène (cf. §6).
- **Groupement** : « 7 personnes ont aimé *Titre du billet* » plutôt que 7
  lignes — réduit la charge sans nommer un palmarès.
- Lien profond vers le contenu et l'interaction concernée.

---

## 5. Comportements de fédération & limites assumées

- **Émission** : Like, Announce, réponses et commentaires partent vers les inbox
  distantes via la mécanique Fedify déjà en place (signatures HTTP, delivery).
- **Réception** : symétrique, par l'inbox. Mastodon & co. envoient `Like`,
  `Announce`, et `Create`+`inReplyTo` de façon standard.
- **Limites à documenter pour l'utilisateur, pas à masquer** :
  - La remise fédérée n'est **pas garantie** (instance hors-ligne, défédérée,
    file d'attente). Pas d'accusé de réception fiable.
  - Certaines instances **n'envoient pas les `Like`** par choix de
    confidentialité → des likes distants peuvent ne jamais arriver.
  - On ne contrôle **pas l'affichage distant** : un même billet pourra montrer un
    compteur de favoris/boosts côté Mastodon même si marge ne l'affiche pas.
- `Undo` (dé-liker, dé-partager) doit aussi fédérer, sinon désynchronisation.

---

## 6. Spécifications anti-dark-patterns (contraintes d'UI)

Ces points sont des **exigences**, pas des préférences esthétiques.

- **Pas de compteur public en course.** Décision par défaut à valider (cf. §8) :
  le nombre de likes/partages est visible par l'auteur sur son propre contenu
  (via ses notifications/son tableau de bord), mais n'est **pas** affiché comme
  score public sous chaque publication. Le like fédère normalement ; c'est son
  *affichage chez marge* qui reste sobre.
- **Pas de badge rouge à compteur croissant.** Un indicateur binaire (point
  « il y a du nouveau ») suffit ; pas de nombre qui gonfle.
- **Pas de notification de notification** (« X et 3 autres ont aimé… » réémis
  plusieurs fois). Une interaction = au plus une notification.
- **Pas de classement par engagement.** Ni « tendances », ni tri du feed par
  nombre de partages. Le feed reste chronologique (décision MVP v0.1).
- **Réversibilité visible.** Annuler un like / un partage est aussi simple que
  l'action initiale, sans friction punitive ni confirmation culpabilisante.
- **Le digest n'est pas un teaser.** Il récapitule, il ne crée pas de tension
  pour faire revenir (« connecte-toi pour voir qui… »).

---

## 7. Critères d'acceptation du MVP (cet incrément)

1. Un utilisateur peut liker, dé-liker, commenter (court), répondre (billet) et
   partager un contenu, en local et en fédéré.
2. Les activités correspondantes (`Like`, `Undo`, `Create`+`inReplyTo`,
   `Announce`) sont émises et reçues conformément à ActivityPub et
   interopèrent avec Mastodon.
3. Une réponse-billet apparaît à la fois sous le contenu d'origine et comme
   publication autonome de son auteur.
4. Un utilisateur reçoit des notifications pour les quatre types d'interaction,
   en local et en fédéré.
5. Chaque utilisateur peut régler, par type, le canal (temps réel / digest /
   désactivé) et la portée (local / fédéré) ; les valeurs par défaut du §4.3
   s'appliquent à la création du compte.
6. Aucun compteur public d'engagement n'est affiché sous les publications
   (sous réserve de la décision §8).
7. Le digest groupe les signaux pauvres et ne déclenche aucune interruption au
   coup par coup.

---

## 8. Arbitrage résiduel & pistes V2

**À trancher avant développement :**
- *Affichage des compteurs côté marge.* Le défaut proposé (§6) : visible par
  l'auteur, jamais en score public. Trois variantes possibles : (a) totalement
  invisible, même à l'auteur ; (b) visible à l'auteur seul ; (c) visible à tous
  mais sans tri ni mise en avant. Quelle option ?

**Pistes V2 (hors périmètre) :**
- Seuils et plages horaires de notification.
- Mise en sourdine d'un fil (`mute thread`).
- Réactions qualifiées au-delà du like binaire (accord argumenté, « sourcé »,
  signet) — le signal riche évoqué initialement.
- Annotations marginales (style Hypothes.is) comme troisième mode de commentaire.
- Modération des interactions entrantes (filtrage, blocage d'acteurs/instances).
