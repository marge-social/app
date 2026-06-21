# 0004 — Affichage des compteurs d'engagement

- **Statut** : Proposé
- **Date** : 2026-06-04
- **ADR liés** : [0001](0001-like-activitypub-standard.md), [0002](0002-notifications-reception-vs-amputation.md)

> ADR au statut **Proposé** : à trancher avant développement. Sert ici d'exemple
> de la façon dont un « arbitrage résiduel » se consigne comme décision en
> attente plutôt que de rester dans un fil de discussion.

## Contexte et forces en présence

Les likes existent et fédèrent ([0001](0001-like-activitypub-standard.md)), mais
faut-il **afficher** leur décompte ? Un score public visible réintroduit la
comparaison sociale et la course à l'engagement — contraire à
[0002](0002-notifications-reception-vs-amputation.md). À l'inverse, masquer
entièrement peut nuire à la lisibilité de la réception fédérée.

## Options envisagées

1. **Totalement invisible**, même pour l'auteur.
2. **Visible pour l'auteur seul** — pas de score public.
3. **Visible par tous, mais sans tri ni mise en avant** (jamais utilisé pour
   classer le feed).

## Décision

*À trancher.* Proposition par défaut : **option 2**.

## Conséquences

- À compléter une fois la décision prise (puis passer le statut à `Accepté`).
