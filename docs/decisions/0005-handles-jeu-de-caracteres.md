# 0005 — Jeu de caractères autorisé dans les handles

- **Statut** : Accepté
- **Date** : 2026-06-21
- **Décideurs** : KP
- **ADR liés** : … (politique des domaines d'instance / IDN ; règles d'affichage des identités ; schéma d'identité ActivityPub)

## Contexte et forces en présence

Le handle d'un compte (`@utilisateur@domaine.tld`) est à la fois un identifiant
résolu techniquement — via WebFinger (RFC 7033) et l'URI `acct:` (RFC 7565) — et
un élément d'identité publique, donc une cible d'usurpation. Il faut décider quel
jeu de caractères la **partie locale** accepte. La partie domaine, elle, relève
des règles DNS/IDN et est traitée à part (voir ADR lié).

Forces en présence :

- **Interopérabilité fédiverse** : l'écosystème est hétérogène. Mastodon
  restreint la partie locale à `[a-z0-9_]` (latin, chiffres, underscore, insensible
  à la casse) ; Pleroma, Misskey, WriteFreely sont plus permissifs (tirets, points,
  Unicode). Trop strict, on casse la résolution de comptes distants légitimes ;
  trop permissif, on importe leurs failles.
- **Numérique d'intérêt général / inclusivité** : un·e locuteur·rice sinophone,
  arabophone, cyrillique a une légitimité évidente à un handle dans son écriture.
  Restreindre à l'ASCII latin est un choix politique excluant.
- **Sécurité anti-usurpation** : plus le répertoire autorisé est large, plus
  l'espace des homoglyphes inter-scripts s'ouvre (l'attaque `paypal` avec un « а »
  cyrillique). S'y ajoutent les caractères invisibles, les contrôles
  bidirectionnels et les problèmes de normalisation (deux handles visuellement
  identiques mais distincts au niveau des octets).
- **Positionnement anti-attentionnel** : le handle ne doit pas devenir un terrain
  de surenchère visuelle (emoji, caractères décoratifs, glyphes empilés « Zalgo »)
  ni un vecteur de manipulation de la visibilité.
- **Faisabilité technique** : il faut une règle implémentable de façon
  déterministe à l'inscription **et** à la comparaison, et stable dans le temps.

## Options envisagées

1. **Option A — Restriction ASCII stricte (modèle Mastodon)**
   Partie locale limitée à `[a-z0-9_]`, repli en minuscules.
   *Avantages* : trivial à implémenter, immunité quasi totale aux homoglyphes,
   interopérabilité maximale avec Mastodon.
   *Inconvénients* : exclut d'emblée toute écriture non latine — incompatible avec
   le positionnement NIG ; casse certains comptes distants légitimes (tirets, points).

2. **Option B — Unicode permissif sans garde-fous (modèle Pleroma/Misskey)**
   Acceptation large de l'Unicode, peu ou pas de filtrage.
   *Avantages* : inclusivité linguistique maximale, expressivité.
   *Inconvénients* : ouvre les attaques homographes, les caractères invisibles
   (largeur nulle), les contrôles bidi, les diacritiques empilés ; ambiguïté de
   comparaison sans normalisation imposée. Inacceptable du point de vue sécurité.

3. **Option C — Profil normalisé type PRECIS + garde-fous (retenue)**
   Autorisation large d'Unicode encadrée par le profil `IdentifierClass` de PRECIS
   (RFC 8264 / 8265), avec normalisation, contrainte mono-script et bannissement
   explicite des caractères piégeux ; l'ambiguïté résiduelle est repoussée vers
   l'affichage plutôt que vers l'interdiction.
   *Avantages* : concilie inclusivité et sécurité, s'appuie sur un standard établi.
   *Inconvénients* : implémentation plus exigeante (normalisation, détection de
   script) ; interopérabilité partielle avec les instances ASCII-only en émission.

## Décision

Nous retenons l'**option C**. La règle pour la partie locale d'un handle local est :

- **Répertoire** : profil PRECIS `UsernameCaseMapped` / `IdentifierClass` — en
  pratique, lettres et chiffres uniquement, plus l'underscore. Ce profil interdit
  par construction les contrôles, les symboles (y compris emoji), la ponctuation,
  les espaces, et **tous les points de code à équivalence de compatibilité**
  (formes pleine-chasse, ligatures, chiffres romains, long « s », etc.).
- **Normalisation** : NFC imposée, à l'inscription **et** lors de toute comparaison,
  pour qu'un seul codet et une base + diacritique combinant ne produisent jamais
  deux handles distincts.
- **Casse** : repli en minuscules (insensibilité à la casse), pour neutraliser
  `Bob` / `bob`.
- **Mono-script** : un handle ne peut mélanger plusieurs systèmes d'écriture
  (détection façon UTS #39). Le latin reste tolérablement combinable avec les
  chiffres ASCII.
- **Bannissement explicite** : caractères de largeur nulle (U+200B–U+200D, U+FEFF),
  contrôles bidirectionnels (U+202A–U+202E, U+2066–U+2069), diacritiques empilés
  au-delà d'un seuil, sélecteurs de variation.
- **Ambiguïté résiduelle** : traitée à l'**affichage** (signalement visuel ou
  rendu désambiguïsé des identités à script inhabituel), non par interdiction.

Cette option l'emporte parce qu'elle est la seule à honorer simultanément le
positionnement NIG (pas d'exclusion des écritures non latines) et l'exigence
anti-usurpation, en s'adossant à un standard (PRECIS) plutôt qu'à une liste
maison fragile.

## Conséquences

- **Rendu vrai / imposé** : tout handle local est une chaîne PRECIS valide,
  normalisée NFC, mono-script, en minuscules. La comparaison d'identifiants
  devient déterministe.
- **Fermé / complexifié** : pas d'emoji ni de caractères décoratifs dans les
  handles ; quelques comptes distants non conformes (handles multi-scripts ou à
  ponctuation exotique) pourront être non résolus ou affichés avec un avertissement.
  Coût d'implémentation et de tests supérieur à un simple `[a-z0-9_]`.
- **Implications techniques** :
  - Validation à l'inscription via une bibliothèque PRECIS (`precis-i18n`,
    `golang.org/x/text/secure/precis`, etc.) plutôt qu'une regex.
  - Stockage de la forme normalisée comme clé de comparaison ; conservation
    éventuelle d'une forme d'affichage distincte.
  - Cohérence avec la résolution WebFinger / `acct:` : exclure les caractères
    réservés d'URI (`@ / ? # :`) et les contrôles reste impératif.
  - Asymétrie assumée avec la **partie domaine** (IDN/punycode), où se logent les
    homographes les plus dangereux — traitée dans un ADR dédié.
- **Questions résiduelles (à trancher ailleurs)** :
  - Politique sur les domaines internationalisés de l'instance et normalisation IDN
    des noms d'hôte (cf. comportement Mastodon ≥ 4.0 sur la vérification `rel=me`)
    → ADR « politique des domaines / IDN ».
  - Règles précises d'affichage et de signalement des identités à script inhabituel
    → ADR « affichage des identités ».
  - Longueur minimale/maximale du handle et réservation de noms sensibles
    (`admin`, `support`…) → hors périmètre de cette décision.
