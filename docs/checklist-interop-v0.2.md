# Checklist de vérification — Module v0.2 (Interactions & Notifications)

> Le module est **vérifié en local** (build/tsc/lint + parcours multi-comptes).
> Cette checklist couvre ce qui **reste à valider** : l'**interopérabilité
> Mastodon réelle** (émission + réception des activités via un tunnel public),
> la conformité **anti-dark-patterns (§6)** et le passage en revue des
> **critères d'acceptation (§7)**.

---

## 0. Pré-requis / mise en route

- [ ] Postgres lancé, migrations appliquées : `npm run db:migrate` (jusqu'à `0007`).
- [ ] Tunnel public actif : `cloudflared tunnel --url http://localhost:3000`
      (ou ngrok). Noter l'URL/host publics (`https://xxxx.trycloudflare.com`).
- [ ] `.env` : `APP_URL` **et** `INSTANCE_DOMAIN` pointent sur l'URL/host du
      tunnel (sinon WebFinger échoue : mismatch d'hôte).
- [ ] Relancer `npm run dev` après modif `.env` (l'origine canonique Fedify est
      lue au démarrage).
- [ ] Worker de livraison démarré : `instrumentation.ts` → `startQueue` (sans
      `await`). Vérifier dans les logs qu'il tourne.
- [ ] Un compte Mastodon de test prêt (instance tierce).
- [ ] Découverte OK : depuis Mastodon, chercher `@<handle>@<host-tunnel>` →
      l'acteur marge apparaît (Person, avatar, bio). WebFinger + NodeInfo OK.

---

## 1. Like (§2.1) — bascule + Undo

**Émission (marge → Mastodon)**
- [ ] Depuis marge, liker un statut **distant** (Mastodon) → un `Like` arrive sur
      l'instance distante (favori visible côté Mastodon).
- [ ] Dé-liker → un `Undo(Like)` fédère → le favori disparaît côté Mastodon.
- [ ] Re-liker le même objet → réactivation (pas de doublon ; 1 seule ligne
      `interactions`).

**Réception (Mastodon → marge)**
- [ ] Depuis Mastodon, mettre en favori un **billet/Note marge** → reçu en inbox
      → `interactions` (type Like, origin `federated`) + compteur public mis à jour.
- [ ] Retirer le favori → `Undo(Like)` reçu → compteur décrémenté.
- [ ] ⚠️ Certaines instances **n'émettent pas les Like** (choix de confidentialité)
      → un like distant peut ne jamais arriver : comportement à documenter, pas un bug.

---

## 2. Commentaire court (§2.2) — Note + inReplyTo

**Émission**
- [ ] Commenter (≤500 car.) un statut **distant** → `Create(Note)` avec
      `inReplyTo` + l'auteur distant en `cc` → la réponse apparaît dans le fil de
      discussion côté Mastodon (threadée sous l'original).
- [ ] La Note est déréférençable : ouvrir `/users/:handle/notes/:id` (Accept JSON-LD).

**Réception**
- [ ] Répondre depuis Mastodon à un **billet/Note marge** → reçu en inbox →
      s'affiche **sous** le contenu d'origine dans le fil marge (commentaire en entier).
- [ ] Le commentaire reçu **n'apparaît pas** en top-level du fil.

---

## 3. Réponse-billet (§2.3) — Article + inReplyTo, double existence

**Émission**
- [ ] Depuis le fil, « Répondre par un billet » → `/compose?replyTo=…` (bandeau
      « En réponse à… ») → publier → `Create(Article)` avec `inReplyTo`.
- [ ] **Double existence** côté marge : le billet apparaît (a) en **top-level**
      du fil (publication autonome) ET (b) en **référence titrée** dans le thread
      du parent.
- [ ] Côté Mastodon : la réponse-billet apparaît comme statut threadé sous
      l'original (selon le rendu d'Article de l'instance).

**Réception**
- [ ] Un `Create(Article)+inReplyTo` distant ciblant un objet marge → reçu →
      référence titrée dans le thread + (si auteur distant suivi) visible top-level.

---

## 4. Partage / Announce (§2.4) — bascule + Undo + ré-émission

**Émission**
- [ ] Partager un objet (local ou distant) → `Announce` vers les followers du
      partageur → les abonnés **distants** (Mastodon) le reçoivent comme boost.
- [ ] Dé-partager → `Undo(Announce)` fédère → boost retiré côté Mastodon.

**Réception + ré-émission (cœur du §2.4)**
- [ ] Booster un **billet/Note marge** depuis Mastodon → reçu en inbox.
- [ ] Un abonné marge de l'acteur Mastodon (qui ne suit pas l'auteur original)
      voit l'objet **ré-émis** dans son fil, libellé « partagé par X », daté à
      l'instant du partage, et l'objet partagé a bien été **ingéré** (déréférencé).
- [ ] Transmis **tel quel** : aucune surcouche d'amplification, pas de tendance,
      pas de tri par nb de partages (§6).

---

## 5. Notifications réglables (§4.2) + digest (§4.3/§4.4)

**Défauts « calm by default » (§4.3)**
- [ ] `/preferences` affiche la matrice : Réponses-billets & Commentaires = **temps
      réel** ; Partages & J'aime = **digest** ; portée **local + fédéré** partout.

**Canal**
- [ ] Réponse/commentaire **distants** ciblant mon contenu → **notification temps
      réel** immédiate (lien profond « voir »).
- [ ] Like/partage **distants** par défaut → **pas** de notif temps réel ;
      atterrit en file `digest_items`.
- [ ] Régler J'aime → **temps réel**, puis un like distant → notif immédiate.
- [ ] Régler un type → **désactivé** → aucune notif ni item de digest.

**Portée**
- [ ] Régler un type → **fédéré seulement** : une interaction **locale** (marge↔marge)
      est filtrée (rien) ; une interaction **fédérée** passe.
- [ ] Inverse avec **local seulement**.

**Digest (cron)**
- [ ] Accumuler ≥2 likes (défaut digest) sur un même contenu d'auteurs distincts.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/digest`
      → réponse `{items, notifications, recipients}`.
- [ ] Une **notification groupée** « X et N-1 autres ont aimé … » apparaît
      (`group_count` > 1), file `digest_items` vidée (`digested_at` renseigné).
- [ ] Re-lancer le cron → **idempotent** (0 nouvelle notif).
- [ ] Un like **annulé** avant le digest **n'est pas compté** (filtre interactions actives).
- [ ] Le digest **ne relance pas** (pas de teaser « connecte-toi pour voir… », §6).

---

## 6. Conformité anti-dark-patterns (§6) — revue UI

- [ ] **Aucun compteur public en course** sous les publications hormis le like/partage
      discret (option §8 **c** : visible de tous, **jamais** utilisé pour trier).
- [ ] Le fil reste **chronologique strict** — aucun classement par engagement.
- [ ] **Réversibilité visible** : dé-liker / dé-partager aussi simple que l'action,
      sans confirmation culpabilisante.
- [ ] **Une interaction = au plus une notification** (pas de « notification de
      notification »).
- [ ] Indicateur de non-lues **binaire/sobre** (pas de badge rouge qui gonfle de
      façon anxiogène — à confirmer/ajuster sur le badge nav actuel).
- [ ] Compteurs d'engagement RSS / Fediverse distants **non réaffichés** côté marge.

---

## 7. Critères d'acceptation du MVP (§7) — récap

- [ ] 1. Like, dé-like, commentaire, réponse-billet, partage — en local **et** fédéré.
- [ ] 2. `Like` / `Undo` / `Create+inReplyTo` / `Announce` émis & reçus conformes AP,
        interopèrent avec Mastodon.
- [ ] 3. Réponse-billet : sous le contenu d'origine **et** publication autonome.
- [ ] 4. Notifications pour les 4 types, local & fédéré.
- [ ] 5. Réglage par type du canal (temps réel/digest/désactivé) et de la portée ;
        défauts §4.3 à la création du compte.
- [ ] 6. Aucun compteur public classant sous les publications (décision §8).
- [ ] 7. Le digest groupe les signaux pauvres, aucune interruption au coup par coup.

---

## 8. Non-régression (déjà vert en local — à re-confirmer en prod/tunnel)

- [ ] `npx tsc --noEmit` propre ; `npx eslint` propre ; build OK.
- [ ] Follow/Unfollow (interne + distant) + Accept toujours OK.
- [ ] Publication Article/Note + Update/Delete fédérés toujours OK.
- [ ] Suppression de compte (RGPD) → `Delete(Person)` émis avant purge.
- [ ] Blocage d'acteur → contenu **et** commentaires/boosts exclus du fil.
- [ ] Polling RSS (`/api/cron/poll`) inchangé.

---

## 9. Pistes V2 (hors périmètre — §8)

Seuils de notification, plages horaires, mute thread, réactions qualifiées
(accord argumenté / « sourcé » / signet), annotations marginales (Hypothes.is),
modération avancée des interactions entrantes.
