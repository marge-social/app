# 0003 — Dédoublement du « commenter » : `Note` vs `Article`

- **Statut** : Accepté
- **Date** : 2026-06-04
- **ADR liés** : [0002](0002-notifications-reception-vs-amputation.md)

## Contexte et forces en présence

« Commenter » recouvre deux intentions très différentes sur un média du temps
long : la réaction brève sous un contenu, et la réponse développée qui mérite
d'exister comme publication à part entière. Les fondre en un seul objet
appauvrirait le second et favoriserait la réaction à chaud.

## Options envisagées

1. **Commentaire court uniquement** (sous le contenu).
2. **Réponse-billet uniquement** (logique trackback).
3. **Les deux, explicitement distingués.**

## Décision

**Option 3.** Deux primitives distinctes, correspondant à deux objets
ActivityPub :

- **Commentaire court** → `Note`, placé **sous** le contenu d'origine.
- **Réponse-billet** → `Article`, qui **remonte dans le feed** comme une
  publication autonome de son auteur.

Les deux portent `inReplyTo` vers le contenu d'origine.

## Conséquences

- Avec le `Like` ([0001](0001-like-activitypub-standard.md)) et le partage
  (`Announce`), Marge compte **quatre** primitives sociales — pas trois.
- Justifie une **table d'interactions typée** plutôt qu'un compteur générique.
- Une réponse-billet apparaît à deux endroits : sous le contenu d'origine **et**
  dans le fil de son auteur.
- L'annotation marginale (style Hypothes.is) comme troisième mode de commentaire
  est renvoyée en V2.
