import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Octets bruts (Postgres `bytea`) — pour stocker les avatars en base (§Lot 5). */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Pièce jointe d'un objet distant (cahier médias §4.2), stockée en jsonb sur
 * `remote_objects.attachments`. `url` pointe l'origine distante (jamais re-hébergé).
 */
export interface RemoteAttachment {
  kind: "image" | "video" | "audio" | "pdf";
  url: string;
  mediaType: string;
  name?: string | null;
  width?: number | null;
  height?: number | null;
  /**
   * Vignette/affiche d'une vidéo distante (PeerTube : `icon`). Sert de poster
   * sans charger la vidéo tant que l'utilisateur ne lance pas la lecture.
   */
  poster?: string | null;
  /**
   * Playlist HLS (`application/x-mpegURL`) d'une vidéo distante quand elle est
   * distincte de `url` (PeerTube HLS-only : `url` = m3u8). Lue via hls.js.
   */
  hlsUrl?: string | null;
}

/**
 * Vignette Open Graph du lien mis en avant d'une note (jsonb sur
 * `posts.link_preview`). Résolue côté serveur à la publication ; `imageUrl`
 * pointe l'origine distante (jamais re-hébergé, même logique que les items RSS).
 */
export interface LinkPreview {
  url: string;
  domain: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
}

// --- Enums ---------------------------------------------------------------

/** Statut de propriété d'un flux RSS (cf. §4 / F3). */
export const feedOwnershipStatus = pgEnum("feed_ownership_status", [
  "orphan", // référencé, sans propriétaire
  "claimed", // rattaché à un compte vérifié
  "opt_out", // refusé, dé-référencé
]);

/** Statut technique d'un flux (polling). */
export const feedTechStatus = pgEnum("feed_tech_status", ["active", "error"]);

/** Statut d'un article. */
export const articleStatus = pgEnum("article_status", ["draft", "published"]);

/** Nature d'un média stocké (liste blanche §3.2 du cahier médias). */
export const mediaKind = pgEnum("media_kind", [
  "image",
  "video",
  "audio",
  "pdf",
]);

/** Type de demande sur un flux. */
export const feedClaimType = pgEnum("feed_claim_type", ["claim", "opt_out"]);

/** Statut d'une demande de réclamation / opt-out. */
export const feedClaimStatus = pgEnum("feed_claim_status", [
  "pending",
  "verified",
  "rejected",
]);

/** Statut d'une relation Follow ActivityPub. */
export const followStatus = pgEnum("follow_status", ["pending", "accepted"]);

/** Rôle d'un compte local (contrôle d'accès admin, V1). */
export const userRole = pgEnum("user_role", ["user", "admin"]);

/**
 * Type de notification. V1 n'émet que `follow` ; les autres valeurs sont
 * prévues pour brancher likes/réponses/mentions/partages sans refonte (§2.3).
 */
export const notificationType = pgEnum("notification_type", [
  "follow",
  "like",
  "comment",
  "reply",
  "mention",
  "announce",
]);

/**
 * Type d'interaction sociale journalisée (§2 du module Interactions). `Like` et
 * `Announce` sont des bascules (réversibles via `undone_at`) ; `Comment` et
 * `Reply` sont des objets `Note`/`Article` à part entière (un par interaction),
 * journalisés ici pour le compte des réponses rattachées via `inReplyTo`.
 */
export const interactionType = pgEnum("interaction_type", [
  "Like",
  "Announce",
  "Comment",
  "Reply",
]);

/**
 * Canal de remise d'une notification (§4.2). `realtime` = interrompt
 * immédiatement ; `digest` = accumulé en silence, regroupé périodiquement ;
 * `off` = désactivé.
 */
export const notificationChannel = pgEnum("notification_channel", [
  "realtime",
  "digest",
  "off",
]);

/** Portée d'une notification (§4.2) : origine(s) prise(s) en compte. */
export const notificationScope = pgEnum("notification_scope", [
  "all", // local + fédéré
  "local",
  "federated",
]);

// --- Users / identité fédérée -------------------------------------------

/**
 * Compte authentifié + projection ActivityPub (Actor fusionné au MVP, §4).
 * Les clés privées sont stockées chiffrées dans `privateKeys`.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Handle unique sur l'instance (partie locale, ex. "claire" → @claire@domaine).
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  // Langue d'interface préférée (code BCP-47 court : "fr", "en"…). Texte libre
  // (pas un enum) pour ajouter une langue sans migration. Défaut : français.
  locale: text("locale").notNull().default("fr"),
  // Rôle de supervision (admin = accès aux vues /admin en lecture seule, §3).
  role: userRole("role").notNull().default("user"),
  // Renseigné quand un avatar est défini. Sert de garde d'affichage ET de jeton
  // de cache-busting (mtime). null = pas d'avatar.
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  // Avatar stocké sur le stockage objet (cahier médias) : référence la ligne
  // `media`. null = avatar legacy (octets dans `userAvatars`) ou aucun avatar.
  avatarMediaId: uuid("avatar_media_id").references((): AnyPgColumn => media.id, {
    onDelete: "set null",
  }),
  // Paires de clés de l'acteur AP (RSA-PKCS#1-v1.5 + Ed25519).
  // publicKeys : JWK publics en clair. privateKeys : JWK privés chiffrés (AES-GCM).
  publicKeys: jsonb("public_keys"),
  privateKeys: text("private_keys"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Sessions d'authentification (cookie → session opaque). */
export const sessions = pgTable("sessions", {
  // Hash SHA-256 du token de session (le token brut n'est jamais stocké).
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// --- Articles (publication interne + AP) --------------------------------

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Source Markdown + rendu HTML sanitisé.
    contentMarkdown: text("content_markdown").notNull(),
    contentHtml: text("content_html").notNull(),
    summary: text("summary").notNull().default(""),
    slug: text("slug").notNull(),
    status: articleStatus("status").notNull().default("draft"),
    // IRI de l'objet auquel ce billet répond (§2.3, réponse-billet). null =
    // billet autonome. Renseigné → double existence : reste en top-level du fil
    // ET rattaché au contenu d'origine via inReplyTo.
    inReplyToUri: text("in_reply_to_uri"),
    // URI ActivityPub de l'objet Article (rempli à la publication, dès S2).
    apUri: text("ap_uri"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Permalien stable : /@handle/[slug] → unique par auteur.
    unique("articles_author_slug_unq").on(t.authorId, t.slug),
    index("articles_published_idx").on(t.publishedAt),
    index("articles_in_reply_to_idx").on(t.inReplyToUri),
  ],
);

/**
 * Messages courts du composer (microblog), SANS titre (§Lot 3). Fédérés comme
 * objets `Note` ActivityPub — distincts des `Article` (billets titrés). Publiés
 * immédiatement (pas de brouillon en V1) ; permalien dérivé de l'id.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Source Markdown + rendu HTML sanitisé (même pipeline que les articles).
    contentMarkdown: text("content_markdown").notNull(),
    contentHtml: text("content_html").notNull(),
    // IRI de l'objet auquel cette Note répond (§2.2). null = Note autonome
    // (composer) ; renseigné = commentaire court, affiché sous son parent et
    // exclu du fil top-level.
    inReplyToUri: text("in_reply_to_uri"),
    // Vignette Open Graph du lien mis en avant (choisi au composer, résolu
    // côté serveur à la publication). null = aucune vignette.
    linkPreview: jsonb("link_preview").$type<LinkPreview | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("posts_author_idx").on(t.authorId),
    index("posts_published_idx").on(t.publishedAt),
    index("posts_in_reply_to_idx").on(t.inReplyToUri),
  ],
);

/**
 * Avatar d'un compte local, stocké en base (§Lot 5, choix Postgres). Table
 * séparée des `users` pour ne pas charger les octets à chaque lecture de
 * session/profil. Servi via /api/avatar/[handle].
 */
export const userAvatars = pgTable("user_avatars", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Média générique stocké sur le stockage objet (cahier médias). Sert aux pièces
 * jointes des posts/articles ET aux avatars. Les octets vivent dans le bucket
 * S3 (jamais en base) ; ici seulement les métadonnées + l'URL publique stable.
 *
 * Lien post↔média : `postId`/`articleId` nullable — **un seul média par post**
 * en V1 (contrôle applicatif), modèle extensible à plusieurs (plusieurs lignes
 * pointant le même parent). Le `name` original n'est pas conservé comme clé
 * (UUID généré, anti-collision/path-traversal).
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    // Type MIME validé par les magic bytes (jamais celui fourni par le client).
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    thumbnailKey: text("thumbnail_key"),
    thumbnailUrl: text("thumbnail_url"),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    // Texte alternatif (obligatoire pour les images, §4.1).
    altText: text("alt_text"),
    // Rattachement à un contenu (au plus un des deux). null/null = média non
    // encore attaché (ex. avatar, référencé via users.avatarMediaId).
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("media_post_idx").on(t.postId),
    index("media_article_idx").on(t.articleId),
    index("media_owner_idx").on(t.ownerUserId),
  ],
);

// --- Flux RSS (interne) --------------------------------------------------

/**
 * Flux RSS référencé sur Marge. Modèle « permissionless mais contestable » :
 * owner null = orphelin. Ne fédère JAMAIS.
 */
export const feeds = pgTable(
  "feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // null si orphelin ; renseigné après réclamation vérifiée.
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    feedUrl: text("feed_url").notNull().unique(),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    ownershipStatus: feedOwnershipStatus("ownership_status")
      .notNull()
      .default("orphan"),
    techStatus: feedTechStatus("tech_status").notNull().default("active"),
    techError: text("tech_error"),
    // Utilisateur à l'origine du référencement (audit).
    referencedBy: uuid("referenced_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // Texte intégral réhébergé : faux par défaut, activable seulement par un
    // propriétaire d'un flux réclamé (sinon : extrait + lien uniquement).
    fullTextAllowed: boolean("full_text_allowed").notNull().default(false),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feeds_owner_idx").on(t.ownerId)],
);

/**
 * Item récupéré d'un flux. Récupéré UNE FOIS par flux puis redistribué.
 * Dé-doublonnage par (feed, guid). Orphelin → extrait seulement.
 */
export const feedItems = pgTable(
  "feed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    guid: text("guid").notNull(),
    title: text("title").notNull().default(""),
    link: text("link").notNull(),
    author: text("author"),
    // Extrait toujours stocké ; contenu intégral seulement si fullTextAllowed.
    excerpt: text("excerpt").notNull().default(""),
    contentHtml: text("content_html"),
    // Image d'aperçu la plus pertinente (Media RSS, enclosure, 1er <img> ou
    // og:image de la page). URL distante, jamais réhébergée (cf. F3).
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("feed_items_feed_guid_unq").on(t.feedId, t.guid),
    index("feed_items_published_idx").on(t.publishedAt),
  ],
);

/** Abonnement INTERNE d'un user à un flux (≠ Follow ActivityPub). */
export const feedSubscriptions = pgTable(
  "feed_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("feed_subscriptions_unq").on(t.userId, t.feedId)],
);

/** Demande de réclamation OU d'opt-out d'un flux, avec preuve de contrôle. */
export const feedClaims = pgTable("feed_claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  feedId: uuid("feed_id")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  claimantId: uuid("claimant_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: feedClaimType("type").notNull(),
  // Méthode de vérification (MVP : "token").
  verificationMethod: text("verification_method").notNull().default("token"),
  token: text("token").notNull(),
  status: feedClaimStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

/** URLs/domaines de flux ayant fait l'objet d'un opt-out vérifié. */
export const blocklist = pgTable("blocklist", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Valeur normalisée (URL exacte ou domaine).
  value: text("value").notNull().unique(),
  // "url" ou "domain".
  kind: text("kind").notNull().default("url"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Fédération ActivityPub ---------------------------------------------

/** Cache des acteurs distants connus (suivis ou suiveurs). */
export const remoteActors = pgTable("remote_actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  uri: text("uri").notNull().unique(),
  handle: text("handle"), // @user@domaine
  name: text("name"),
  inboxUrl: text("inbox_url"),
  sharedInboxUrl: text("shared_inbox_url"),
  url: text("url"),
  iconUrl: text("icon_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Relation de suivi ActivityPub. Cible TOUJOURS un acteur (local ou distant),
 * jamais un flux. Les extrémités locales ont un userId renseigné.
 */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // URI de l'acteur suivant / suivi (identité canonique des deux côtés).
    followerUri: text("follower_uri").notNull(),
    followingUri: text("following_uri").notNull(),
    // Renseignés quand l'extrémité est un compte local.
    followerUserId: uuid("follower_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    followingUserId: uuid("following_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    status: followStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("follows_unq").on(t.followerUri, t.followingUri),
    index("follows_following_idx").on(t.followingUri),
    index("follows_follower_idx").on(t.followerUri),
  ],
);

/**
 * Objets distants reçus en inbox (Create Note/Article) pour alimenter le feed.
 * Stockés/indexés pour la fusion chronologique (S3/S6).
 */
export const remoteObjects = pgTable(
  "remote_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectUri: text("object_uri").notNull().unique(),
    attributedToUri: text("attributed_to_uri").notNull(),
    type: text("type").notNull(), // Note | Article
    name: text("name"),
    contentHtml: text("content_html"),
    summary: text("summary"),
    url: text("url"),
    // IRI du parent quand l'objet distant est une réponse (§2.2). Permet de
    // l'afficher sous son parent (commentaire) plutôt qu'en top-level du fil.
    inReplyToUri: text("in_reply_to_uri"),
    // Pièces jointes du contenu distant (cahier médias §4.2) : liste blanche des
    // Document/Image reçus, pour les afficher. Servis depuis leur origine
    // distante, jamais re-stockés.
    attachments: jsonb("attachments").$type<RemoteAttachment[]>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("remote_objects_author_idx").on(t.attributedToUri),
    index("remote_objects_published_idx").on(t.publishedAt),
    index("remote_objects_in_reply_to_idx").on(t.inReplyToUri),
  ],
);

/**
 * Blocage d'un acteur distant par un utilisateur (modération minimale, F7).
 * Le contenu de l'acteur bloqué est exclu du fil et le suivi est rompu.
 */
export const actorBlocks = pgTable(
  "actor_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUri: text("actor_uri").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("actor_blocks_unq").on(t.userId, t.actorUri)],
);

/**
 * Pages de contenu éditables depuis l'admin (mentions légales, etc.), en
 * **Markdown**. `contentHtml` est la version **sanitisée** pré-rendue, servie au
 * public (cf. articles). Une page par `slug`. Tant qu'aucune ligne n'existe pour
 * un slug, l'app sert un contenu par défaut (cf. `src/lib/pages.ts`).
 */
export const sitePages = pgTable("site_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  contentHtml: text("content_html").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Notifications destinées à un auteur local (§2). Table générique : V1 ne crée
 * que des notifications `follow`, mais la forme accueille likes/réponses/etc.
 * sans migration de structure. Les infos d'affichage de l'acteur déclencheur
 * sont mises en cache pour éviter une requête réseau à chaque rendu de liste.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    // Acteur déclencheur (URI canonique) + projection d'affichage mise en cache.
    actorUri: text("actor_uri").notNull(),
    actorHandle: text("actor_handle").notNull(),
    actorName: text("actor_name"),
    actorIconUrl: text("actor_icon_url"),
    // Objet concerné (billet liké/répondu) ; null pour un `follow`.
    objectUri: text("object_uri"),
    // Nombre d'acteurs regroupés (§4.4) : 1 pour une notif temps réel ; >1 pour
    // une notif de digest (« N personnes ont aimé … »). `actor*` = représentant.
    groupCount: integer("group_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // null = non lue.
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_recipient_created_idx").on(
      t.recipientUserId,
      t.createdAt.desc(),
    ),
    index("notifications_recipient_read_idx").on(t.recipientUserId, t.readAt),
  ],
);

/**
 * Préférences de notification par utilisateur et par type d'interaction (§4.2,
 * matrice réglable). On ne stocke que les **dérogations** : en l'absence de
 * ligne, les défauts « calm by default » du §4.3 s'appliquent (résolus en code).
 * `type` ∈ {like, comment, reply, announce} (le `follow` n'est pas réglable).
 */
export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    channel: notificationChannel("channel").notNull(),
    scope: notificationScope("scope").notNull(),
  },
  (t) => [unique("notification_settings_user_type_unq").on(t.userId, t.type)],
);

/**
 * File des signaux mis en **digest** (§4.3) : chaque interaction routée vers le
 * canal `digest` y atterrit au lieu de créer une notification temps réel. Le
 * moteur de digest (cron) les regroupe périodiquement en notifications « N
 * personnes ont … » puis renseigne `digestedAt`. `origin` permet d'honorer la
 * portée a posteriori si besoin ; l'acteur est projeté pour l'affichage.
 */
export const digestItems = pgTable(
  "digest_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    origin: text("origin").notNull().default("local"), // "local" | "federated"
    actorUri: text("actor_uri").notNull(),
    actorHandle: text("actor_handle").notNull(),
    actorName: text("actor_name"),
    actorIconUrl: text("actor_icon_url"),
    objectUri: text("object_uri"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // null = en attente de regroupement ; renseigné quand digéré.
    digestedAt: timestamp("digested_at", { withTimezone: true }),
  },
  (t) => [
    index("digest_items_pending_idx").on(t.recipientUserId, t.digestedAt),
  ],
);

/**
 * Journal des interactions sociales reçues et émises (§3 du module
 * Interactions). On stocke systématiquement les **IRI** de l'acteur et de
 * l'objet (jamais une clé locale seule) pour traiter local et fédéré de façon
 * homogène. `Like`/`Announce` sont des bascules : l'annulation renseigne
 * `undoneAt` (la ligne est conservée) plutôt que de supprimer. Le compte public
 * d'une interaction = lignes du type voulu, `objectIri` donné, `undoneAt` nul.
 */
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: interactionType("type").notNull(),
    // Acteur à l'origine (local ou distant) et objet visé — IRI canoniques.
    actorIri: text("actor_iri").notNull(),
    objectIri: text("object_iri").notNull(),
    // IRI de l'activité émise/reçue (utile pour l'Undo et l'audit). Pour un Like
    // local, reconstructible, mais stocké pour les activités distantes reçues.
    activityIri: text("activity_iri"),
    origin: text("origin").notNull().default("local"), // "local" | "federated"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // null = active ; renseigné quand l'interaction (Like/Announce) est annulée.
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [
    index("interactions_object_idx").on(t.objectIri),
    index("interactions_actor_idx").on(t.actorIri),
    // Un acteur ne peut liker/partager qu'UNE fois un même objet (idempotence,
    // §2.1) : unicité partielle réservée aux bascules. Les commentaires/réponses
    // (un objet par interaction) ne sont pas contraints.
    uniqueIndex("interactions_toggle_unq")
      .on(t.type, t.actorIri, t.objectIri)
      .where(sql`type in ('Like', 'Announce')`),
  ],
);

/**
 * Relevé périodique de volumétrie (monitoring admin). Enregistré au plus une
 * fois par ~20 h, au chargement de /admin/storage (pas de cron dédié). Sert à
 * suivre la croissance de la base (notamment `remote_objects`/`feed_items`,
 * non purgés) et à anticiper le dimensionnement du serveur.
 */
export const storageSnapshots = pgTable(
  "storage_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // pg_database_size : base entière (tables + index + TOAST).
    dbSizeBytes: bigint("db_size_bytes", { mode: "number" }).notNull(),
    // Détail par table { relname: pg_total_relation_size } — inclut les tables
    // hors schéma Drizzle (KV/queue Fedify) puisque lu depuis pg_class.
    tableSizes: jsonb("table_sizes").$type<Record<string, number>>().notNull(),
    // Octets cumulés des médias S3 (somme de media.size_bytes ; les miniatures,
    // non journalisées, ne sont pas comptées — sous-estime légèrement).
    mediaBytes: bigint("media_bytes", { mode: "number" }).notNull(),
    // Disque vu par le processus app (statfs). En conteneur : le système de
    // fichiers du conteneur, pas forcément le volume Postgres. null si échec.
    diskTotalBytes: bigint("disk_total_bytes", { mode: "number" }),
    diskFreeBytes: bigint("disk_free_bytes", { mode: "number" }),
  },
  (t) => [index("storage_snapshots_captured_idx").on(t.capturedAt.desc())],
);

// --- Relations (pour les requêtes typées Drizzle) -----------------------

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
  posts: many(posts),
  ownedFeeds: many(feeds),
  feedSubscriptions: many(feedSubscriptions),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  owner: one(users, { fields: [feeds.ownerId], references: [users.id] }),
  items: many(feedItems),
  subscriptions: many(feedSubscriptions),
}));

export const feedItemsRelations = relations(feedItems, ({ one }) => ({
  feed: one(feeds, { fields: [feedItems.feedId], references: [feeds.id] }),
}));

export const feedSubscriptionsRelations = relations(
  feedSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [feedSubscriptions.userId],
      references: [users.id],
    }),
    feed: one(feeds, {
      fields: [feedSubscriptions.feedId],
      references: [feeds.id],
    }),
  }),
);
