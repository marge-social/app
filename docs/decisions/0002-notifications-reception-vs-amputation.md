# 0002 — Anti-attention par la réception, non par l'amputation

- **Statut** : Accepté
- **Date** : 2026-06-04
- **ADR liés** : [0001](0001-like-activitypub-standard.md), [0003](0003-commenter-dedouble-note-vs-article.md)

## Contexte et forces en présence

Comment tenir le positionnement anti-attentionnel **sans** mutiler les fonctions
sociales (ce qui briserait l'interopérabilité, cf. [0001](0001-like-activitypub-standard.md)) ?
La logique toxique des plateformes ne tient pas tant aux gestes eux-mêmes
(liker, partager) qu'à la manière dont ces signaux sont **réinjectés** dans
l'attention de l'utilisateur (interruptions, classement par engagement, FOMO).

## Options envisagées

1. **Agir sur le geste** : supprimer ou brider les fonctions sociales.
2. **Agir sur la réception** : conserver les fonctions standard, mais donner à
   l'utilisateur la maîtrise de ce qui mérite de l'interrompre, et bannir les
   mécaniques de mise en avant par l'engagement.

## Décision

**Option 2.** Principe directeur :

> Le réseau parle normalement au Fediverse ; c'est l'utilisateur qui décide de
> ce qui mérite de l'interrompre.

Déclinaisons retenues :

- **Notifications à granularité entièrement réglable** par type d'interaction
  (canal : temps réel / digest / désactivé ; portée : local / fédéré).
- **Feed chronologique** au MVP — pas de classement par engagement, pas de
  « tendances ».
- **Digest récapitulatif, jamais teaser** : il résume, il ne crée pas de tension
  pour faire revenir.
- **Réversibilité visible** : annuler un like / un partage est aussi simple que
  l'action initiale, sans friction culpabilisante.
- **Pas de notification de notification** : une interaction = au plus une
  notification.

## Conséquences

- Le levier anti-attentionnel devient un **paramétrage**, pas une suppression ;
  c'est une position de design plus mûre et défendable publiquement (NIG /
  Designers Éthiques).
- Implique un système de préférences de notification par utilisateur et par
  type, avec valeurs par défaut sobres.
- Les seuils horaires, le `mute thread` et la modération fine des entrants sont
  renvoyés en V2.
