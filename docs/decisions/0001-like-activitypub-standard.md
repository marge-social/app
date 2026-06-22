# 0001 — Statut du « Like » : standard ActivityPub

- **Statut** : Accepté
- **Date** : 2026-06-04
- **ADR liés** : [0002](0002-notifications-reception-vs-amputation.md), [0004](0004-affichage-compteurs-engagement.md)

## Contexte et forces en présence

Le « Like » est un signal pauvre, emblématique des mécaniques attentionnelles
que marge veut éviter. Deux forces s'opposent :

- le **positionnement anti-attentionnel** pousse à se méfier du like, voire à le
  supprimer ;
- l'**interopérabilité fédérée** (ActivityPub, compatibilité Mastodon) suppose
  de parler le vocabulaire standard du protocole, dont `Like` fait partie.

## Options envisagées

1. **Supprimer le like.** Geste fort, mais casse l'interopérabilité (les
   instances distantes émettent des `Like` qu'il faudrait ignorer) et déplace le
   problème sans le résoudre.
2. **Like standard, assumé tel quel.** On ne triche pas avec le protocole : le
   signal existe et fédère normalement.
3. **Like « riche » / qualifié** (accord argumenté, « sourcé », signet). Plus
   conforme à l'esprit du projet, mais non standard donc non interopérable au
   MVP.

## Décision

**Option 2.** Le `Like` est un `Like` ActivityPub standard, assumé. Le travail
éthique n'est pas porté par l'amputation du geste mais par sa **réception**
(voir [0002](0002-notifications-reception-vs-amputation.md)).

## Conséquences

- marge parle normalement au Fediverse ; les `Like` entrants/sortants
  interopèrent avec Mastodon.
- L'effort de design se reporte sur les notifications et l'absence de mise en
  avant par l'engagement.
- L'**affichage** d'un compteur de likes reste une question distincte, non
  tranchée → [0004](0004-affichage-compteurs-engagement.md).
- Les réactions qualifiées (signal riche) sont renvoyées en V2.
