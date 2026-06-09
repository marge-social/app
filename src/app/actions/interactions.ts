"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { actorUri } from "@/lib/config";
import { resolveInteractionTarget, setToggle } from "@/lib/interactions";
import {
  deliverAnnounce,
  deliverComment,
  deliverLike,
  deliverUndoAnnounce,
  deliverUndoLike,
} from "@/federation/delivery";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { fediverseHandle } from "@/lib/config";
import { renderMarkdown } from "@/lib/markdown";
import { routeInteractionNotification } from "@/lib/notifications";

/**
 * Bascule le like du spectateur sur un objet (§2.1). Le champ `liked` porte
 * l'état VOULU après le clic (le client envoie l'inverse de l'état courant) —
 * idempotent côté serveur. Émet le `Like`/`Undo(Like)` fédéré si l'auteur est
 * distant ; un like local↔local reste en base (le compteur le reflète).
 */
export async function toggleLikeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const objectIri = ((formData.get("objectIri") as string) ?? "").trim();
  const liked = formData.get("liked") === "true";
  if (!objectIri) return;

  const target = await resolveInteractionTarget(objectIri);
  if (!target) return; // objet inconnu : on ne like pas un IRI arbitraire.

  await setToggle({
    type: "Like",
    actorIri: actorUri(user.handle),
    objectIri,
    origin: "local",
    active: liked,
  });

  // Notification de l'auteur local (routée par sa matrice — défaut like=digest,
  // §4.3) ; seulement au like, jamais au dé-like, jamais pour soi-même.
  if (
    liked &&
    target.authorIsLocal &&
    target.authorUserId &&
    target.authorUserId !== user.id
  ) {
    await routeInteractionNotification({
      recipientUserId: target.authorUserId,
      type: "like",
      origin: "local",
      actor: {
        uri: actorUri(user.handle),
        handle: fediverseHandle(user.handle),
        name: user.displayName,
      },
      objectUri: objectIri,
    });
  }

  if (!target.authorIsLocal) {
    if (liked) {
      await deliverLike(user.handle, objectIri, target.authorActorUri);
    } else {
      await deliverUndoLike(user.handle, objectIri, target.authorActorUri);
    }
  }

  revalidatePath("/");
}

/**
 * Bascule le partage (`Announce`) du spectateur sur un objet (§2.4). Le champ
 * `shared` porte l'état VOULU. Réémet l'objet vers les followers du partageur
 * (re-diffusion dans leur fil). Défaut *digest* (§4.3) → aucune notification
 * temps réel ici ; le journal `interactions` alimentera le digest.
 */
export async function toggleAnnounceAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const objectIri = ((formData.get("objectIri") as string) ?? "").trim();
  const shared = formData.get("shared") === "true";
  if (!objectIri) return;

  const target = await resolveInteractionTarget(objectIri);
  if (!target) return; // on ne partage qu'un objet connu.

  await setToggle({
    type: "Announce",
    actorIri: actorUri(user.handle),
    objectIri,
    origin: "local",
    active: shared,
  });

  // Notification de l'auteur du contenu partagé (routée — défaut announce=digest,
  // §4.3) ; seulement au partage, jamais pour soi-même.
  if (
    shared &&
    target.authorIsLocal &&
    target.authorUserId &&
    target.authorUserId !== user.id
  ) {
    await routeInteractionNotification({
      recipientUserId: target.authorUserId,
      type: "announce",
      origin: "local",
      actor: {
        uri: actorUri(user.handle),
        handle: fediverseHandle(user.handle),
        name: user.displayName,
      },
      objectUri: objectIri,
    });
  }

  // Réémission vers les followers du partageur (local comme distant).
  if (shared) {
    await deliverAnnounce(user.handle, objectIri);
  } else {
    await deliverUndoAnnounce(user.handle, objectIri);
  }

  revalidatePath("/");
}

const COMMENT_MAX_LEN = 500;

/**
 * Publie un commentaire court (§2.2) : une `Note` Markdown avec `inReplyTo`
 * vers `objectIri`. Affichée sous le contenu d'origine (jamais en top-level du
 * fil). Notifie l'auteur local en temps réel (défaut §4.3, sauf auto-réponse)
 * ou fédère la réponse à son instance si l'auteur est distant.
 */
export async function createCommentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const objectIri = ((formData.get("objectIri") as string) ?? "").trim();
  const body = ((formData.get("body") as string) ?? "").trim();
  if (!objectIri || !body || body.length > COMMENT_MAX_LEN) return;

  const target = await resolveInteractionTarget(objectIri);
  if (!target) return; // on ne commente qu'un objet connu.

  const contentHtml = renderMarkdown(body);
  const [post] = await db
    .insert(posts)
    .values({
      authorId: user.id,
      contentMarkdown: body,
      contentHtml,
      inReplyToUri: objectIri,
    })
    .returning();

  // Auteur local : notification routée par sa matrice (défaut comment=temps
  // réel, §4.3 ; sauf commentaire de soi).
  if (
    target.authorIsLocal &&
    target.authorUserId &&
    target.authorUserId !== user.id
  ) {
    await routeInteractionNotification({
      recipientUserId: target.authorUserId,
      type: "comment",
      origin: "local",
      actor: {
        uri: actorUri(user.handle),
        handle: fediverseHandle(user.handle),
        name: user.displayName,
      },
      objectUri: objectIri,
    });
  }

  // Fédération : aux followers + à l'auteur distant le cas échéant.
  await deliverComment(
    user.handle,
    post,
    target.authorIsLocal ? null : target.authorActorUri,
  );

  revalidatePath("/");
}
