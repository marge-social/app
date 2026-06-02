import { Article, Delete, Tombstone, Update } from "@fedify/fedify/vocab";
import {
  buildArticleObject,
  buildCreateForArticle,
  ensureFederationStorage,
  federation,
} from "@/federation/federation";
import { articles } from "@/db/schema";
import { APP_URL } from "@/lib/config";

type ArticleRow = typeof articles.$inferSelect;

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
