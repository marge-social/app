import "server-only";
import { and, desc, eq, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  type RemoteAttachment,
  actorBlocks,
  articles,
  feedItems,
  feedSubscriptions,
  feeds,
  follows,
  interactions,
  posts,
  remoteActors,
  remoteObjects,
  users,
} from "@/db/schema";
import {
  APP_URL,
  actorUri,
  articleApUri,
  fediverseHandle,
  noteApUri,
} from "@/lib/config";
import { getToggleStatsFor } from "@/lib/interactions";
import {
  type MediaView,
  loadMediaForArticles,
  loadMediaForPosts,
} from "@/lib/media";
import { effectiveSummary, htmlToText, readingTimeMinutes } from "@/lib/markdown";

/** Convertit les pièces jointes distantes (jsonb) en projection d'affichage. */
function remoteToMediaViews(
  attachments: RemoteAttachment[] | null | undefined,
): MediaView[] {
  if (!attachments) return [];
  return attachments.map((a) => ({
    kind: a.kind,
    url: a.url,
    mimeType: a.mediaType,
    alt: a.name ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
    thumbnailUrl: a.poster ?? null,
    hlsUrl: a.hlsUrl ?? null,
  }));
}

export type FeedEntryKind = "note" | "article" | "remote" | "rss";

/**
 * Une réponse rattachée à une entrée du fil via `inReplyTo` : commentaire court
 * (§2.2, `contentHtml` affiché en entier) ou réponse-billet (§2.3, `title`
 * renseigné → rendue comme référence titrée vers la publication autonome).
 */
export interface CommentView {
  key: string;
  authorLabel: string;
  /** Handle local de l'auteur (avatar/lien interne) ; absent si distant. */
  authorHandle?: string;
  /** Renseigné pour une réponse-billet : rendue en lien titré, pas en entier. */
  title?: string;
  contentHtml: string;
  date: Date;
  href: string;
  internal: boolean;
}

export interface FeedEntry {
  key: string;
  kind: FeedEntryKind;
  title: string | null;
  authorLabel: string;
  /** Handle local de l'auteur (pour l'avatar) ; absent pour distant/RSS. */
  authorHandle?: string;
  date: Date;
  /** Aperçu honnête (article/distant/RSS). */
  summary: string;
  /** Corps complet sanitisé (notes natives, affichées en entier). */
  contentHtml?: string;
  href: string;
  /** Lien interne (Next <Link>) vs externe (<a>). */
  internal: boolean;
  /** Clé de source (le libellé affiché est traduit au rendu — cf. dict.feed.sources). */
  source: "local" | "fediverse" | "rss";
  readingMinutes?: number;
  /**
   * IRI ActivityPub de l'objet, présent quand l'entrée est likeable (billets,
   * notes, objets distants). Absent pour les items RSS — un flux ne fédère
   * jamais et n'est pas un objet AP (§ conventions). `likeCount`/`likedByViewer`
   * sont renseignés pour ces entrées (compteur public, option c).
   */
  objectUri?: string;
  likeCount: number;
  likedByViewer: boolean;
  /** Partages (§2.4) — compteur public, jamais utilisé pour trier (§6/§8c). */
  shareCount: number;
  sharedByViewer: boolean;
  /**
   * Renseigné quand l'entrée est une **ré-émission** (§2.4) : libellé du
   * partageur (« partagé par X »). L'objet sous-jacent est inchangé.
   */
  sharedBy?: string;
  /** Commentaires courts rattachés (§2.2), ordre chronologique croissant. */
  comments: CommentView[];
  /** Pièces jointes (cahier médias §4.1) : 0 ou 1 en V1, extensible. */
  media: MediaView[];
}

const PREVIEW_LEN = 280;

/**
 * Construit le fil unifié d'un utilisateur (§Lot 3) : fusion chronologique
 * stricte des billets/notes des comptes Marge suivis **et de soi-même**, des
 * objets distants des comptes Fediverse suivis, et des items des flux RSS
 * suivis. Aucun classement algorithmique, aucun compteur d'engagement.
 *
 * Pagination par taille cumulative : on récupère `limit + 1` entrées pour
 * savoir s'il en reste (`hasMore`), puis on tronque à `limit`.
 */
export async function buildFeed(
  viewer: { id: string; handle: string; displayName: string },
  opts: { limit: number },
): Promise<{ entries: FeedEntry[]; hasMore: boolean }> {
  const fetchLimit = opts.limit + 1;

  // Comptes Marge suivis + soi-même (pour voir ses propres publications).
  const localFollows = await db
    .select({ id: users.id, handle: users.handle, name: users.displayName })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingUserId))
    .where(
      and(
        eq(follows.followerUserId, viewer.id),
        isNotNull(follows.followingUserId),
        eq(follows.status, "accepted"),
      ),
    );

  const localAccounts = new Map<string, { handle: string; name: string }>();
  localAccounts.set(viewer.id, {
    handle: viewer.handle,
    name: viewer.displayName,
  });
  for (const f of localFollows) {
    localAccounts.set(f.id, { handle: f.handle, name: f.name });
  }
  const localIds = [...localAccounts.keys()];

  // Comptes distants suivis.
  const remoteFollows = await db
    .select({
      uri: follows.followingUri,
      name: remoteActors.name,
      handle: remoteActors.handle,
    })
    .from(follows)
    .leftJoin(remoteActors, eq(remoteActors.uri, follows.followingUri))
    .where(
      and(
        eq(follows.followerUserId, viewer.id),
        isNull(follows.followingUserId),
      ),
    );

  const blockedRows = await db
    .select({ actorUri: actorBlocks.actorUri })
    .from(actorBlocks)
    .where(eq(actorBlocks.userId, viewer.id));
  const blockedUris = new Set(blockedRows.map((b) => b.actorUri));

  const entries: FeedEntry[] = [];

  // Billets (Articles publiés) des comptes locaux.
  if (localIds.length > 0) {
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        summary: articles.summary,
        content: articles.contentMarkdown,
        publishedAt: articles.publishedAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(
        and(
          inArray(articles.authorId, localIds),
          eq(articles.status, "published"),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(fetchLimit);
    const articleMedia = await loadMediaForArticles(rows.map((r) => r.id));
    for (const r of rows) {
      const a = localAccounts.get(r.authorId)!;
      entries.push({
        key: `a:${r.id}`,
        kind: "article",
        title: r.title,
        authorLabel: `${a.name} · ${fediverseHandle(a.handle)}`,
        authorHandle: a.handle,
        date: r.publishedAt ?? new Date(0),
        summary: effectiveSummary(r.content, r.summary),
        href: `/@${a.handle}/${r.slug}`,
        internal: true,
        source: "local",
        readingMinutes: readingTimeMinutes(r.content),
        objectUri: articleApUri(a.handle, r.slug),
        likeCount: 0,
        likedByViewer: false,
        shareCount: 0,
        sharedByViewer: false,
        comments: [],
        media: articleMedia.get(r.id) ?? [],
      });
    }

    // Messages courts (Notes) des comptes locaux — affichés en entier. Les
    // commentaires (inReplyTo renseigné) sont exclus du top-level : ils
    // s'affichent sous leur parent (§2.2).
    const postRows = await db
      .select({
        id: posts.id,
        contentHtml: posts.contentHtml,
        publishedAt: posts.publishedAt,
        authorId: posts.authorId,
      })
      .from(posts)
      .where(
        and(inArray(posts.authorId, localIds), isNull(posts.inReplyToUri)),
      )
      .orderBy(desc(posts.publishedAt))
      .limit(fetchLimit);
    const noteMedia = await loadMediaForPosts(postRows.map((r) => r.id));
    for (const r of postRows) {
      const a = localAccounts.get(r.authorId)!;
      entries.push({
        key: `p:${r.id}`,
        kind: "note",
        title: null,
        authorLabel: `${a.name} · ${fediverseHandle(a.handle)}`,
        authorHandle: a.handle,
        date: r.publishedAt,
        summary: "",
        contentHtml: r.contentHtml,
        href: `/@${a.handle}/notes/${r.id}`,
        internal: true,
        source: "local",
        objectUri: noteApUri(a.handle, r.id),
        likeCount: 0,
        likedByViewer: false,
        shareCount: 0,
        sharedByViewer: false,
        comments: [],
        media: noteMedia.get(r.id) ?? [],
      });
    }
  }

  // Contenus distants des comptes Fediverse suivis.
  const remoteUris = remoteFollows
    .map((f) => f.uri)
    .filter((uri) => !blockedUris.has(uri));
  if (remoteUris.length > 0) {
    // Top-level : on exclut les **commentaires** distants (Note + inReplyTo,
    // affichés sous leur parent) mais on garde les **réponses-billets** (Article
    // + inReplyTo), publications autonomes à part entière (double existence §2.3).
    const rows = await db
      .select()
      .from(remoteObjects)
      .where(
        and(
          inArray(remoteObjects.attributedToUri, remoteUris),
          or(
            eq(remoteObjects.type, "Article"),
            isNull(remoteObjects.inReplyToUri),
          ),
        ),
      )
      .orderBy(desc(remoteObjects.publishedAt))
      .limit(fetchLimit);
    const labelByUri = new Map(
      remoteFollows.map((f) => [f.uri, f.handle ?? f.name ?? f.uri]),
    );
    for (const r of rows) {
      const text = r.contentHtml ? htmlToText(r.contentHtml) : "";
      entries.push({
        key: `r:${r.id}`,
        kind: "remote",
        title: r.name,
        authorLabel: labelByUri.get(r.attributedToUri) ?? r.attributedToUri,
        date: r.publishedAt ?? r.fetchedAt,
        summary:
          r.summary ??
          (text.length > PREVIEW_LEN ? `${text.slice(0, PREVIEW_LEN)}…` : text),
        href: r.url ?? r.objectUri,
        internal: false,
        source: "fediverse",
        objectUri: r.objectUri,
        likeCount: 0,
        likedByViewer: false,
        shareCount: 0,
        sharedByViewer: false,
        comments: [],
        media: remoteToMediaViews(r.attachments),
      });
    }
  }

  // Items des flux RSS suivis (FeedSubscription, indépendant du follow compte).
  const subRows = await db
    .select({
      feedId: feedSubscriptions.feedId,
      feedTitle: feeds.title,
      feedUrl: feeds.feedUrl,
    })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feeds.id, feedSubscriptions.feedId))
    .where(eq(feedSubscriptions.userId, viewer.id));
  if (subRows.length > 0) {
    const feedLabel = new Map(
      subRows.map((s) => [s.feedId, s.feedTitle || s.feedUrl]),
    );
    const rows = await db
      .select()
      .from(feedItems)
      .where(
        inArray(
          feedItems.feedId,
          subRows.map((s) => s.feedId),
        ),
      )
      .orderBy(desc(feedItems.publishedAt))
      .limit(fetchLimit);
    for (const r of rows) {
      entries.push({
        key: `f:${r.id}`,
        kind: "rss",
        title: r.title,
        authorLabel: r.author
          ? `${r.author} · ${feedLabel.get(r.feedId)}`
          : (feedLabel.get(r.feedId) ?? ""),
        date: r.publishedAt ?? r.fetchedAt,
        summary: r.excerpt,
        href: r.link,
        internal: false,
        source: "rss",
        likeCount: 0,
        likedByViewer: false,
        shareCount: 0,
        sharedByViewer: false,
        comments: [],
        media: [],
      });
    }
  }

  // Partages (Announce, §2.4) des comptes suivis + soi → ré-émission de l'objet
  // dans le fil, daté à l'instant du partage (« partagé par X »). L'objet n'est
  // jamais altéré (§6) ; on ne réémet que ce qu'on sait rendre.
  const sharerLabel = new Map<string, string>();
  for (const [, acc] of localAccounts) {
    sharerLabel.set(actorUri(acc.handle), acc.name);
  }
  for (const f of remoteFollows) {
    sharerLabel.set(f.uri, f.handle ?? f.name ?? f.uri);
  }
  const announceRows = await db
    .select({
      objectIri: interactions.objectIri,
      actorIri: interactions.actorIri,
      date: interactions.createdAt,
    })
    .from(interactions)
    .where(
      and(
        eq(interactions.type, "Announce"),
        isNull(interactions.undoneAt),
        inArray(interactions.actorIri, [...sharerLabel.keys()]),
      ),
    )
    .orderBy(desc(interactions.createdAt))
    .limit(fetchLimit);

  if (announceRows.length > 0) {
    const localPrefix = `${APP_URL}/users/`;
    const wantSlugs: string[] = [];
    const wantNoteIds: string[] = [];
    const wantRemote: string[] = [];
    for (const a of announceRows) {
      if (a.objectIri.startsWith(localPrefix)) {
        const [, kind, id] = a.objectIri.slice(localPrefix.length).split("/");
        if (kind === "articles") wantSlugs.push(id);
        else if (kind === "notes") wantNoteIds.push(id);
      } else {
        wantRemote.push(a.objectIri);
      }
    }

    const artRows = wantSlugs.length
      ? await db
          .select({
            id: articles.id,
            slug: articles.slug,
            title: articles.title,
            summary: articles.summary,
            content: articles.contentMarkdown,
            handle: users.handle,
            name: users.displayName,
          })
          .from(articles)
          .innerJoin(users, eq(users.id, articles.authorId))
          .where(
            and(
              inArray(articles.slug, wantSlugs),
              eq(articles.status, "published"),
            ),
          )
      : [];
    const artByIri = new Map<string, (typeof artRows)[number]>();
    for (const r of artRows) artByIri.set(articleApUri(r.handle, r.slug), r);

    const noteRows = wantNoteIds.length
      ? await db
          .select({
            id: posts.id,
            contentHtml: posts.contentHtml,
            handle: users.handle,
            name: users.displayName,
          })
          .from(posts)
          .innerJoin(users, eq(users.id, posts.authorId))
          .where(inArray(posts.id, wantNoteIds))
      : [];
    const noteByIri = new Map<string, (typeof noteRows)[number]>();
    for (const r of noteRows) noteByIri.set(noteApUri(r.handle, r.id), r);

    const remRows = wantRemote.length
      ? await db
          .select({
            objectUri: remoteObjects.objectUri,
            type: remoteObjects.type,
            name: remoteObjects.name,
            contentHtml: remoteObjects.contentHtml,
            summary: remoteObjects.summary,
            url: remoteObjects.url,
            attachments: remoteObjects.attachments,
            author: remoteObjects.attributedToUri,
            actorHandle: remoteActors.handle,
            actorName: remoteActors.name,
          })
          .from(remoteObjects)
          .leftJoin(
            remoteActors,
            eq(remoteActors.uri, remoteObjects.attributedToUri),
          )
          .where(inArray(remoteObjects.objectUri, wantRemote))
      : [];
    const remByIri = new Map<string, (typeof remRows)[number]>();
    for (const r of remRows) remByIri.set(r.objectUri, r);

    // Médias des objets locaux ré-émis (partages), chargés en lot.
    const [announcedArticleMedia, announcedNoteMedia] = await Promise.all([
      loadMediaForArticles(artRows.map((r) => r.id)),
      loadMediaForPosts(noteRows.map((r) => r.id)),
    ]);

    for (const a of announceRows) {
      const by = sharerLabel.get(a.actorIri);
      const key = `sh:${a.actorIri}:${a.objectIri}`;
      const art = artByIri.get(a.objectIri);
      if (art) {
        entries.push({
          key,
          kind: "article",
          title: art.title,
          authorLabel: `${art.name} · ${fediverseHandle(art.handle)}`,
          authorHandle: art.handle,
          date: a.date,
          summary: effectiveSummary(art.content, art.summary),
          href: `/@${art.handle}/${art.slug}`,
          internal: true,
          source: "local",
          readingMinutes: readingTimeMinutes(art.content),
          objectUri: a.objectIri,
          sharedBy: by,
          likeCount: 0,
          likedByViewer: false,
          shareCount: 0,
          sharedByViewer: false,
          comments: [],
          media: announcedArticleMedia.get(art.id) ?? [],
        });
        continue;
      }
      const note = noteByIri.get(a.objectIri);
      if (note) {
        entries.push({
          key,
          kind: "note",
          title: null,
          authorLabel: `${note.name} · ${fediverseHandle(note.handle)}`,
          authorHandle: note.handle,
          date: a.date,
          summary: "",
          contentHtml: note.contentHtml,
          href: `/@${note.handle}/notes/${note.id}`,
          internal: true,
          source: "local",
          objectUri: a.objectIri,
          sharedBy: by,
          likeCount: 0,
          likedByViewer: false,
          shareCount: 0,
          sharedByViewer: false,
          comments: [],
          media: announcedNoteMedia.get(note.id) ?? [],
        });
        continue;
      }
      const rem = remByIri.get(a.objectIri);
      if (rem && !blockedUris.has(rem.author)) {
        const text = rem.contentHtml ? htmlToText(rem.contentHtml) : "";
        entries.push({
          key,
          kind: "remote",
          title: rem.name,
          authorLabel: rem.actorHandle ?? rem.actorName ?? rem.author,
          date: a.date,
          summary:
            rem.summary ??
            (text.length > PREVIEW_LEN
              ? `${text.slice(0, PREVIEW_LEN)}…`
              : text),
          href: rem.url ?? rem.objectUri,
          internal: false,
          source: "fediverse",
          objectUri: rem.objectUri,
          sharedBy: by,
          likeCount: 0,
          likedByViewer: false,
          shareCount: 0,
          sharedByViewer: false,
          comments: [],
          media: remoteToMediaViews(rem.attachments),
        });
      }
    }
  }

  // Tri chronologique strict (du plus récent au plus ancien).
  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasMore = entries.length > opts.limit;
  const visible = entries.slice(0, opts.limit);

  // Compteurs like + partage (toutes origines, jamais utilisés pour trier —
  // §6/§8c), résolus en deux passes agrégées sur les seules entrées affichées.
  const objectIris = visible
    .map((e) => e.objectUri)
    .filter((u): u is string => !!u);
  const viewerIri = actorUri(viewer.handle);
  const [likeStats, shareStats] = await Promise.all([
    getToggleStatsFor("Like", objectIris, viewerIri),
    getToggleStatsFor("Announce", objectIris, viewerIri),
  ]);
  for (const e of visible) {
    if (!e.objectUri) continue;
    const ls = likeStats.get(e.objectUri);
    if (ls) {
      e.likeCount = ls.count;
      e.likedByViewer = ls.activeForViewer;
    }
    const ss = shareStats.get(e.objectUri);
    if (ss) {
      e.shareCount = ss.count;
      e.sharedByViewer = ss.activeForViewer;
    }
  }

  // Réponses rattachées aux entrées affichées, regroupées par parent en fil
  // chronologique croissant : commentaires courts (Note + inReplyTo, en entier,
  // §2.2) ET réponses-billets (Article + inReplyTo, en référence titrée, §2.3),
  // d'origine locale comme distante.
  if (objectIris.length > 0) {
    const byParent = new Map<string, CommentView[]>();
    const push = (parent: string, c: CommentView) => {
      const arr = byParent.get(parent);
      if (arr) arr.push(c);
      else byParent.set(parent, [c]);
    };

    const localComments = await db
      .select({
        id: posts.id,
        contentHtml: posts.contentHtml,
        publishedAt: posts.publishedAt,
        parent: posts.inReplyToUri,
        handle: users.handle,
        name: users.displayName,
      })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(inArray(posts.inReplyToUri, objectIris));
    for (const c of localComments) {
      if (!c.parent) continue;
      push(c.parent, {
        key: `pc:${c.id}`,
        authorLabel: `${c.name} · ${fediverseHandle(c.handle)}`,
        authorHandle: c.handle,
        contentHtml: c.contentHtml,
        date: c.publishedAt,
        href: `/@${c.handle}/notes/${c.id}`,
        internal: true,
      });
    }

    // Réponses-billets locales (Article + inReplyTo, publiées) → référence titrée.
    const localArticleReplies = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        publishedAt: articles.publishedAt,
        parent: articles.inReplyToUri,
        handle: users.handle,
        name: users.displayName,
      })
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .where(
        and(
          inArray(articles.inReplyToUri, objectIris),
          eq(articles.status, "published"),
        ),
      );
    for (const c of localArticleReplies) {
      if (!c.parent) continue;
      push(c.parent, {
        key: `ar:${c.handle}:${c.slug}`,
        authorLabel: `${c.name} · ${fediverseHandle(c.handle)}`,
        authorHandle: c.handle,
        title: c.title || "(sans titre)",
        contentHtml: "",
        date: c.publishedAt ?? new Date(0),
        href: `/@${c.handle}/${c.slug}`,
        internal: true,
      });
    }

    const remoteComments = await db
      .select({
        id: remoteObjects.id,
        type: remoteObjects.type,
        name: remoteObjects.name,
        contentHtml: remoteObjects.contentHtml,
        publishedAt: remoteObjects.publishedAt,
        fetchedAt: remoteObjects.fetchedAt,
        parent: remoteObjects.inReplyToUri,
        url: remoteObjects.url,
        objectUri: remoteObjects.objectUri,
        author: remoteObjects.attributedToUri,
        actorHandle: remoteActors.handle,
        actorName: remoteActors.name,
      })
      .from(remoteObjects)
      .leftJoin(
        remoteActors,
        eq(remoteActors.uri, remoteObjects.attributedToUri),
      )
      .where(inArray(remoteObjects.inReplyToUri, objectIris));
    for (const c of remoteComments) {
      if (!c.parent || blockedUris.has(c.author)) continue;
      const isArticle = c.type === "Article";
      push(c.parent, {
        key: `rc:${c.id}`,
        authorLabel: c.actorHandle ?? c.actorName ?? c.author,
        title: isArticle ? (c.name ?? "(sans titre)") : undefined,
        contentHtml: isArticle ? "" : (c.contentHtml ?? ""),
        date: c.publishedAt ?? c.fetchedAt,
        href: c.url ?? c.objectUri,
        internal: false,
      });
    }

    for (const e of visible) {
      if (!e.objectUri) continue;
      const arr = byParent.get(e.objectUri);
      if (arr) {
        arr.sort((a, b) => a.date.getTime() - b.date.getTime());
        e.comments = arr;
      }
    }
  }

  return { entries: visible, hasMore };
}
