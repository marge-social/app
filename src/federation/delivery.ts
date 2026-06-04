import { Article, Delete, Tombstone, Update } from "@fedify/fedify/vocab";
import {
  buildArticleObject,
  buildCreateForArticle,
  buildCreateForNote,
  ensureFederationStorage,
  federation,
} from "@/federation/federation";
import { articles, posts } from "@/db/schema";
import { APP_URL } from "@/lib/config";

type ArticleRow = typeof articles.$inferSelect;
type PostRow = typeof posts.$inferSelect;

function context() {
  return federation.createContext(new URL(APP_URL), undefined);
}

/**
 * Émet `Create(Article)` vers les followers d'un auteur (via la file Fedify).
 * Les erreurs sont avalées : la publication ne doit pas échouer si la
 * fédération est indisponible (livraison réessayée par la queue).
 */
export async function deliverCreate(
  handle: string,
  article: ArticleRow,
): Promise<void> {
  try {
    await ensureFederationStorage();
    const ctx = context();
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      buildCreateForArticle(ctx, handle, article),
    );
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
    await ctx.sendActivity(
      { identifier: handle },
      "followers",
      buildCreateForNote(ctx, handle, post),
    );
  } catch (err) {
    console.error("[federation] deliverCreateNote failed:", err);
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
    const object = buildArticleObject(ctx, handle, article);
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
