import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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

// --- Relations (pour les requêtes typées Drizzle) -----------------------

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
  ownedFeeds: many(feeds),
  feedSubscriptions: many(feedSubscriptions),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(users, {
    fields: [articles.authorId],
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
