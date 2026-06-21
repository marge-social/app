# Journal de décisions (ADR)

Un **ADR** (*Architecture Decision Record*) consigne une décision structurante :
son **contexte**, les **options envisagées**, la **décision** retenue et ses
**conséquences**.

Principe : le journal est **append-only**. Une décision consignée ne se réécrit
pas. Si l'on change d'avis, on crée un **nouvel** ADR qui *supersède* le
précédent (et l'on passe l'ancien au statut `Remplacé`). On conserve ainsi la
trace du raisonnement, pas seulement de son résultat.

## Statuts

- `Proposé` — en discussion, pas encore tranché (équivaut à tes « arbitrages
  résiduels »).
- `Accepté` — décision en vigueur.
- `Remplacé par 00XX` — décision dépassée par un ADR plus récent.
- `Abandonné` — option finalement écartée.

## Index

| N°                                                    | Décision                                              | Statut  |
|-------------------------------------------------------|-------------------------------------------------------|---------|
| [0001](0001-like-activitypub-standard.md)             | Statut du « Like » : standard ActivityPub             | Accepté |
| [0002](0002-notifications-reception-vs-amputation.md) | Anti-attention par la réception, non par l'amputation | Accepté |
| [0003](0003-commenter-dedouble-note-vs-article.md)    | Dédoublement du « commenter » : `Note` vs `Article`   | Accepté |
| [0004](0004-affichage-compteurs-engagement.md)        | Affichage des compteurs d'engagement                  | Proposé |
| [0005](0005-handles-jeu-de-caracteres.md)             | Choix du handle de l'utilisateur            | Accepté |
| [0006](0006-inscription-deux-temps-email.md)          | Inscription en deux temps avec activation par email   | Accepté |

> Nouveau record : copier [`template.md`](template.md), le numéroter à la suite
> (`NNNN-titre-en-kebab.md`) et l'ajouter à ce tableau et à la `nav` du
> `mkdocs.yml`.
