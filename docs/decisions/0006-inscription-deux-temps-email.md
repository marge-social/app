# 0006 — Inscription en deux temps avec activation par email

- **Statut** : Accepté
- **Date** : 2026-06-21
- **Décideurs** : Karl Pineau
- **ADR liés** : [0005](0005-handles-jeu-de-caracteres.md) (jeu de caractères du handle)

## Contexte et forces en présence

L'inscription historique demandait d'un coup **nom affiché + handle + email +
mot de passe**, créait immédiatement la ligne `users` (avec génération des clés
de l'acteur ActivityPub) et connectait la personne. Deux problèmes :

1. **Friction et engagement.** Choisir un handle fédéré définitif au tout
   premier écran est un point de bascule : on demande une décision identitaire
   structurante avant que la personne ait vu le produit.
2. **Emails non vérifiés.** Rien ne prouvait le contrôle de l'adresse. Des
   comptes fantômes (fautes de frappe, inscriptions abandonnées, robots)
   polluaient `users` — qui porte l'identité fédérée et des clés cryptographiques.

On veut : une entrée la plus légère possible (email + mot de passe), une **preuve
de contrôle de l'email** avant tout compte « réel », et un **onboarding** dédié
où l'on configure tranquillement le profil. Or aucune brique d'envoi d'email
n'existait dans le projet.

Contraintes : ne pas introduire de demi-compte dans `users` (le handle, le nom et
les clés AP doivent rester **non nuls et garantis** pour tout le code de
fédération qui résout un acteur par son handle) ; respecter la gouvernance des
dépendances (§ *Dépendances* du CLAUDE.md) ; rester auto-hébergeable.

## Options envisagées

1. **`users` mutable avec colonnes nullables + statut.** Rendre `handle`,
   `displayName` nullables, ajouter `email_verified_at` / `onboarded_at`, et
   garder la personne connectée mais bridée tant que l'onboarding n'est pas fini.
   *Contre* : `handle` devient `string | null` partout → ondée d'erreurs de type
   et de gardes à travers toute la fédération ; demi-comptes à filtrer dans
   chaque requête ; gardes d'onboarding à recâbler sur toutes les routes.
2. **Handle provisoire généré à l'inscription.** Attribuer un handle aléatoire
   puis le renommer à l'onboarding. *Contre* : un acteur fédérable au handle
   provisoire peut fuiter ; collisions et logique de réservé à dupliquer ;
   renommage d'acteur AP non trivial.
3. **Table `pending_signups` séparée + flux tokenisé (retenue).** L'état
   pré-activation vit **hors de `users`**. Un jeton à usage unique (seul son
   **hash** est stocké) part par email. Au clic, on entre dans l'onboarding
   (toujours porté par le jeton, sans session) ; à la **fin** de l'onboarding on
   crée la ligne `users` complète (handle + clés AP), on supprime la ligne
   `pending_signups` et on ouvre la session.

Pour l'envoi d'email : (a) **nodemailer/SMTP**, (b) **API HTTP tierce**
(Resend/Postmark…), (c) **client SMTP maison**.

## Décision

**Option 3** : inscription en deux temps via `pending_signups`, flux **tokenisé**
(pas de session tant que l'onboarding n'est pas finalisé).

- Inscription = **email + mot de passe** seulement → ligne `pending_signups`
  (mot de passe haché argon2id, hash SHA-256 du jeton) + envoi de l'email
  d'activation. Aucune session, aucune ligne `users`.
- Clic sur le lien → `verified_at` posé (preuve de contrôle) → onboarding.
- Fin d'onboarding → création de `users` (handle + nom + clés AP) → suppression
  de `pending_signups` → session ouverte.
- **Maintenance** (cron `/api/cron/signups`) : si le lien n'est **jamais cliqué**
  (`verified_at` nul), **rappel à 48 h** puis **suppression à 96 h**.

Pour l'email : **nodemailer en SMTP** (option a). Un client SMTP/MIME maison
(STARTTLS, AUTH, encodage des en-têtes) entre exactement dans la catégorie
« authentification + réseau non fiable » de la liste blanche du CLAUDE.md : le
réécrire serait une faille quasi garantie. nodemailer est le standard de fait,
**sans dépendance transitive** (`npm ls nodemailer`), activement maintenu et au
`npm audit` propre (≥ 9.0.1). Une API tierce ajouterait un service externe et un
compte à gérer, à rebours de l'auto-hébergement. Une **abstraction**
(`src/lib/mail.ts`) isole le transport : SMTP en prod, **transport « journal »**
(le lien s'écrit dans la console) si `SMTP_HOST` n'est pas défini, pour dérouler
tout le flux en local sans serveur mail.

## Conséquences

- **`users` reste intègre** : `handle`, `display_name` et les clés AP demeurent
  non nuls — zéro impact de typage sur la fédération, aucun demi-compte à filtrer.
- **Pas d'état connecté-mais-bridé** : on n'a pas besoin de garde d'onboarding
  sur chaque route. On est soit dans le wizard tokenisé (sans session), soit
  titulaire d'un compte complet.
- L'unicité de l'email se vérifie désormais sur **`users` *et* `pending_signups`**.
- La suppression à 96 h est triviale (on efface une ligne `pending_signups`,
  aucune cascade applicative). Elle ne vise que les inscriptions **non cliquées**
  (`verified_at` nul) : un lien activé reste rejouable pour reprendre un
  onboarding interrompu.
- Nouvelle dépendance **structurante** `nodemailer` (runtime) ; nouvelles
  variables `SMTP_*` / `MAIL_FROM`. Le transport est réversible (l'abstraction
  `mail.ts` pourrait basculer vers une API sans toucher aux appelants).
- **Questions résiduelles** (hors de cet ADR) : la **réinitialisation de mot de
  passe** (« mot de passe oublié ») réutilisera la même brique email + jeton
  haché, mais n'est pas traitée ici ; le ramasse-miettes des inscriptions
  **activées mais jamais finalisées** (horizon long) reste à définir.

## Addendum — 2026-06-22 : connexion sur un compte non activé

Le découplage `pending_signups` / `users` a un angle mort d'expérience : une
personne qui s'est inscrite mais n'a **jamais cliqué** sur le lien d'activation
n'a **aucune ligne `users`**. À sa tentative de connexion, `loginAction` ne
trouvait rien et renvoyait le message générique « email ou mot de passe
incorrect » — l'utilisateur n'avait aucun moyen de comprendre que son compte
existe et n'attend qu'une activation, ni de relancer l'email (souvent perdu ou
classé en indésirable).

**Précision de la décision** (ne révise pas l'option 3, l'étend) : à la
connexion, si aucun compte activé ne correspond, on cherche une inscription en
attente par email (`findPendingByEmail`). On ne dévoile son existence et on ne
**renvoie un lien d'activation** (`resendActivation`, jeton tourné — seul le hash
est stocké, le précédent est invalidé) **qu'après vérification du mot de passe** :
un mot de passe erroné conserve le message générique. L'invariant
**anti-énumération** est ainsi préservé — l'information « compte en attente
d'activation » n'est accessible qu'à qui détient déjà les identifiants — tout en
offrant une sortie de secours claire. Aucun schéma ni session n'est touché : on
reste dans le flux tokenisé jusqu'à la finalisation de l'onboarding.
