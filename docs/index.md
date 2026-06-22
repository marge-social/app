# marge — Documentation

**marge** est un média social du temps long : un espace de lecture lente et de
production exigeante, à contre-courant de l'économie attentionnelle des
plateformes dominantes. Il agrège des flux (RSS), permet d'écrire et de débattre
en contenus longs, et fédère via ActivityPub dans une logique de **numérique
d'intérêt général** et d'interopérabilité ouverte.

Cette documentation distingue volontairement **trois artefacts** aux
temporalités différentes — ne pas les confondre est la condition d'une
documentation qui ne dérive pas :

| Artefact | Temporalité | Mutabilité | Question à laquelle il répond |
|---|---|---|---|
| [Cahier des charges](cahier-des-charges/index.md) | Présent | Mutable | *Ce que marge **est** aujourd'hui* |
| [Journal de décisions (ADR)](decisions/index.md) | Passé | Append-only | *Pourquoi marge est ainsi* |
| [Roadmap](roadmap.md) | Futur | Mutable, priorisée | *Ce qu'on implémente ensuite* |

## Comment naviguer

- Le **cahier des charges** est la spécification vivante : on la met à jour quand
  l'état du produit change.
- Le **journal de décisions** ne se réécrit pas : une décision prise reste
  consignée ; si on en change, on ajoute un nouvel ADR qui **supersède** le
  précédent.
- La **roadmap** synthétise ici les grandes phases ; le pilotage fin et vivant
  se fait sur le tableau GitHub Projects (lien dans la page Roadmap).

> Cette documentation est publiée automatiquement sur GitHub Pages à chaque
> `push` sur `main`. La source unique de vérité reste le dossier `docs/` du
> dépôt — toute modification passe par une *pull request* relue, pour garantir
> la traçabilité et la provenance.
