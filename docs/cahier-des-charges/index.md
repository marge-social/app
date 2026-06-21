# Cahier des charges

> Spécification **vivante** de Marge — décrit l'état présent du produit.
> Mutable : à mettre à jour dès que le périmètre évolue. Le *pourquoi* des choix
> n'est pas ici mais dans le [journal de décisions](../decisions/index.md).

## Architecture technique (synthèse)

- **Fédération** : ActivityPub via **Fedify** (« le Rails du Fediverse »).
- **Base de données** : PostgreSQL, ORM **Drizzle**.
- **Cache / file d'attente** : Redis recommandé (adaptateur Postgres possible
  pour démarrer).
- **Agrégation** : parsing RSS + planificateur (cron de polling périodique).
- **Contenu** : édition en **Markdown**, rendu HTML, permaliens stables.

## Modèle de données (entités principales)

`User`, `Actor` (projection ActivityPub), `Article`, `Feed`, `FeedItem`,
`Follow`, `RemoteActor`. Les handles sont de la forme `@handle@instance.tld`,
résolus par WebFinger.

## Modules fonctionnels

- **F1 — Comptes et identité fédérée** : inscription, génération de la paire de
  clés + acteur `Person`, profil public, endpoint WebFinger.
- **F2 — Publication de textes** : éditeur Markdown, publication →
  `Create(Article)` vers les followers.
- **F3 — Agrégation RSS** : abonnement à des flux, polling, dé-doublonnage par
  GUID.
- **F4 — Interactions sociales** : `Like`, commentaire court (`Note`),
  réponse-billet (`Article`), partage (`Announce`) — en local et en fédéré.
- **F5 — Notifications** : granularité entièrement réglable par l'utilisateur
  (canal + portée, par type d'interaction).
- **F6 — Feed** : chronologique au MVP ; algorithme explicable et paramétrable
  prévu (voir roadmap).

---

!!! note "À compléter"
    Colle ici, par module, le détail des spécifications fonctionnelles (reprise
    des cahiers des charges v0.1 « RSS + publication + fédération » et v0.2
    « interactions + notifications »). Une page par module est recommandée
    quand le volume grossit (`cahier-des-charges/f4-interactions.md`, etc.).
