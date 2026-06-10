import {
  Article,
  Delete,
  Note,
  Tombstone,
  Undo,
  Update,
  isActor,
} from "@fedify/fedify/vocab";
import {
  buildAnnounce,
  buildArticleObject,
  buildCreateForArticle,
  buildCreateForNote,
  buildLike,
  buildNoteObject,
  ensureFederationStorage,
  federation,
} from "@/federation/federation";
import { articles, posts } from "@/db/schema";
import { APP_URL } from "@/lib/config";
import { loadMediaForArticles, loadMediaForPosts } from "@/lib/media";

type ArticleRow = typeof articles.$inferSelect;
type PostRow = typeof posts.$inferSelect;

function context() {
  return federation.createContext(new URL(APP_URL), undefined);
}

/**
 * Émet `Create(Article)` vers les followers d'un auteur (via la file Fedify).
 * Pour une réponse-billet (§2.3), `parentAuthorActorUri` (s'il est distant)
 * reçoit aussi la réponse et est ajouté en cc, afin que son instance la thread.
 * Les erreurs sont avalées : la publication ne doit pas échouer si la
 * fédération est indisponible (livraison réessayée par la queue).
 */
export async function deliverCreate(
  handle: string,
  article: ArticleRow,
  parentAuthorActorUri?: string | null,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const remoteParent =
      parentAuthorActorUri != null &&
      !parentAuthorActorUri.startsWith(`${APP_URL}/users/`);
    const attachments =
      (await loadMediaForArticles([article.id])).get(article.id) ?? [];
    const create = buildCreateForArticle(ctx, handle, article, {
      ccActor: remoteParent ? parentAuthorActorUri! : undefined,
      attachments,
    });
    await ctx.sendActivity({ identifier: handle }, "followers", create);
    if (remoteParent) {
      const actor = await ctx.lookupObject(parentAuthorActorUri!).catch(() => null);
      if (isActor(actor)) {
        await ctx.sendActivity({ identifier: handle }, actor, create);
      }
    }
  } catch (err) {
    console.error("[federation] deliverCreate failed:", err);
  }
}

/** Émet `Create(Note)` vers les followers à la publication d'un message court. */
export async function deliverCreateNote(
  handle: string,
  post: PostRow,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const attachments = (await loadMediaForPosts([post.id])).get(post.id) ?? [];
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      buildCreateForNote(ctx, handle, post, { attachments }),
    );
  } catch (err) {
    console.error("[federation] deliverCreateNote failed:", err);
  }
}

/** Émet `Update(Note)` après édition d'un message court. */
export async function deliverUpdateNote(
  handle: string,
  post: PostRow,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const attachments = (await loadMediaForPosts([post.id])).get(post.id) ?? [];
    const object = buildNoteObject(ctx, handle, post, attachments);
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Update({
        id: new URL(`${object.id?.href}#update`),
        actor: ctx.getActorUri(handle),
        object,
      }),
    );
  } catch (err) {
    console.error("[federation] deliverUpdateNote failed:", err);
  }
}

/** Émet `Delete(Tombstone)` après suppression d'un message court. */
export async function deliverDeleteNote(
  handle: string,
  postId: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const objectUri = ctx.getObjectUri(Note, {
      identifier: handle,
      id: postId,
    });
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Delete({
        id: new URL(`${objectUri.href}#delete`),
        actor: ctx.getActorUri(handle),
        object: new Tombstone({ id: objectUri }),
      }),
    );
  } catch (err) {
    console.error("[federation] deliverDeleteNote failed:", err);
  }
}

/**
 * Émet une activité `Like` vers l'instance de l'auteur d'un objet distant
 * (§2.1). Sans effet si l'auteur est local (rien à fédérer) — l'appelant ne
 * délègue ici que pour un auteur distant.
 */
export async function deliverLike(
  handle: string,
  objectIri: string,
  authorActorUri: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const actor = await ctx.lookupObject(authorActorUri).catch(() => null);
    if (!isActor(actor) || actor.id == null) return;
    await ctx.sendActivity(
      { identifier: handle },
      actor,
      buildLike(ctx, handle, objectIri, authorActorUri),
    );
  } catch (err) {
    console.error("[federation] deliverLike failed:", err);
  }
}

/** Émet `Undo(Like)` pour dé-liker un objet distant (§2.1, réversibilité). */
export async function deliverUndoLike(
  handle: string,
  objectIri: string,
  authorActorUri: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const actor = await ctx.lookupObject(authorActorUri).catch(() => null);
    if (!isActor(actor) || actor.id == null) return;
    const like = buildLike(ctx, handle, objectIri, authorActorUri);
    await ctx.sendActivity(
      { identifier: handle },
      actor,
      new Undo({
        id: new URL(`${like.id?.href}#undo`),
        actor: ctx.getActorUri(handle),
        object: like,
      }),
    );
  } catch (err) {
    console.error("[federation] deliverUndoLike failed:", err);
  }
}

/**
 * Émet le `Create(Note)` d'un commentaire court (§2.2) : aux followers de
 * l'auteur, et — si le contenu d'origine est distant — à son auteur pour que
 * son instance reçoive et thread la réponse. La Note porte déjà `inReplyTo`
 * (lu depuis `post.inReplyToUri`).
 */
export async function deliverComment(
  handle: string,
  post: PostRow,
  parentAuthorActorUri: string | null,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const remoteParent =
      parentAuthorActorUri != null &&
      !parentAuthorActorUri.startsWith(`${APP_URL}/users/`);
    const create = buildCreateForNote(
      ctx,
      handle,
      post,
      remoteParent ? { ccActor: parentAuthorActorUri! } : undefined,
    );
    await ctx.sendActivity({ identifier: handle }, "followers", create);
    if (remoteParent) {
      const actor = await ctx.lookupObject(parentAuthorActorUri!).catch(() => null);
      if (isActor(actor)) {
        await ctx.sendActivity({ identifier: handle }, actor, create);
      }
    }
  } catch (err) {
    console.error("[federation] deliverComment failed:", err);
  }
}

/** Émet un `Announce` (partage, §2.4) vers les followers du partageur. */
export async function deliverAnnounce(
  handle: string,
  objectIri: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      buildAnnounce(ctx, handle, objectIri),
    );
  } catch (err) {
    console.error("[federation] deliverAnnounce failed:", err);
  }
}

/** Émet `Undo(Announce)` pour dé-partager (§2.4, réversibilité §6). */
export async function deliverUndoAnnounce(
  handle: string,
  objectIri: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const announce = buildAnnounce(ctx, handle, objectIri);
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Undo({
        id: new URL(`${announce.id?.href}#undo`),
        actor: ctx.getActorUri(handle),
        object: announce,
      }),
    );
  } catch (err) {
    console.error("[federation] deliverUndoAnnounce failed:", err);
  }
}

/** Émet `Update(Article)` après édition d'un article publié. */
export async function deliverUpdate(
  handle: string,
  article: ArticleRow,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const attachments =
      (await loadMediaForArticles([article.id])).get(article.id) ?? [];
    const object = buildArticleObject(ctx, handle, article, attachments);
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Update({
        id: new URL(`${object.id?.href}#update`),
        actor: ctx.getActorUri(handle),
        object,
      }),
    );
  } catch (err) {
    console.error("[federation] deliverUpdate failed:", err);
  }
}

/**
 * Émet `Delete(Person)` aux followers à la suppression d'un compte, pour que
 * les instances distantes purgent l'acteur (RGPD / suppression effective).
 * À appeler AVANT de supprimer l'utilisateur (les clés doivent exister).
 */
export async function deliverActorDelete(handle: string): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const actor = ctx.getActorUri(handle);
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Delete({
        id: new URL(`${actor.href}#delete`),
        actor,
        object: actor,
      }),
      // Livraison immédiate : les clés de signature disparaissent avec le compte.
      { immediate: true },
    );
  } catch (err) {
    console.error("[federation] deliverActorDelete failed:", err);
  }
}

/** Émet `Delete(Tombstone)` après suppression d'un article publié. */
export async function deliverDelete(
  handle: string,
  slug: string,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    const objectUri = ctx.getObjectUri(Article, {
      identifier: handle,
      slug,
    });
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      new Delete({
        id: new URL(`${objectUri.href}#delete`),
        actor: ctx.getActorUri(handle),
        object: new Tombstone({ id: objectUri }),
      }),
    );
  } catch (err) {
    console.error("[federation] deliverDelete failed:", err);
  }
}
