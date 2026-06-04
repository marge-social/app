import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Octets bruts (Postgres `bytea`) — pour stocker les avatars en base (§Lot 5). */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

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
  "reply",
  "mention",
  "announce",
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
  // Rôle de supervision (admin = accès aux vues /admin en lecture seule, §3).
  role: userRole("role").notNull().default("user"),
  // Renseigné quand un avatar est défini (octets dans `userAvatars`). Sert de
  // garde d'affichage ET de jeton de cache-busting (mtime). null = pas d'avatar.
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
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
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("remote_objects_author_idx").on(t.attributedToUri),
    index("remote_objects_published_idx").on(t.publishedAt),
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
