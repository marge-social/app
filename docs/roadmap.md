# Roadmap

> Vue d'ensemble des phases. Le **pilotage vivant** (items priorisés, statuts,
> échéances) se fait sur le tableau **GitHub Projects** :
> 👉 _[remplacer par l'URL de ton GitHub Project]_
>
> Convention : chaque item du board pointe vers l'**ADR** qui le justifie et
> vers l'**issue** qui l'implémente.

## Phase 0 — MVP v0.1 — *Socle*

Agrégation RSS + publication Markdown + fédération ActivityPub (Fedify).
Comptes et identité fédérée (WebFinger, handles `@h@instance.tld`).

## Phase 1 — MVP v0.2 — *Boucle sociale*

`Like`, commentaire court (`Note`), réponse-billet (`Article`), partage
(`Announce`), en local et en fédéré.
Notifications à granularité réglable (cf. [ADR 0002](decisions/0002-notifications-reception-vs-amputation.md)).
**À trancher avant dev :** affichage des compteurs ([ADR 0004](decisions/0004-affichage-compteurs-engagement.md)).

## Phase 2 — *Feed explicable et paramétrable*

Dépasser le chronologique strict : algorithme comme **fonction pure à contrat
défini**, scoring décomposable, équilibrage par quotas/interleaving entre
sources, et « pourquoi » affiché par item. N'utiliser que des signaux nommables
à l'utilisateur ; jamais les likes comme signal de qualité.

## Pistes V2 (hors périmètre actuel)

- Seuils et plages horaires de notification ; mise en sourdine d'un fil
  (`mute thread`).
- Réactions qualifiées au-delà du like binaire (accord argumenté, « sourcé »,
  signet) — le signal riche.
- Annotations marginales (style Hypothes.is) comme troisième mode de commentaire.
- Modération des interactions entrantes (filtrage, blocage d'acteurs/instances).
- Outillage de sourcing / annotation des textes.
