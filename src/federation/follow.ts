import { Follow, Undo, isActor } from "@fedify/fedify/vocab";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows, remoteActors } from "@/db/schema";
import {
  backfillRemoteOutbox,
  ensureFederationStorage,
  federation,
} from "@/federation/federation";
import { APP_URL, actorUri } from "@/lib/config";
import { htmlToText } from "@/lib/markdown";

function context() {
  return federation.createContext(new URL(APP_URL), undefined);
}

export interface RemoteFollowResult {
  ok: boolean;
  error?: string;
}

export interface RemoteActorPreview {
  uri: string;
  handle: string;
  name: string;
  summary: string;
  iconUrl: string | null;
  url: string;
}

/**
 * Résout un acteur distant (WebFinger) pour l'AFFICHER dans la recherche, sans
 * le suivre ni rien persister. Best-effort : renvoie `null` si le handle est
 * introuvable ou ne correspond pas à un compte.
 */
export async function previewRemoteActor(
  target: string,
): Promise<RemoteActorPreview | null> {
  await ensureFederationStorage();
  const ctx = context();
  const handle = target.trim().replace(/^@/, "");

  let actor;
  try {
    actor = await ctx.lookupObject(handle);
  } catch {
    return null;
  }
  if (!isActor(actor) || actor.id == null) return null;

  const username = actor.preferredUsername?.toString() ?? null;
  const displayHandle = username
    ? `@${username}@${actor.id.host}`
    : `@${actor.id.host}`;

  let iconUrl: string | null = null;
  try {
    const icon = await actor.getIcon();
    const u = icon?.url;
    iconUrl = u instanceof URL ? u.href : (u?.href?.href ?? null);
  } catch {
    // Avatar indisponible : dégradation gracieuse.
  }

  return {
    uri: actor.id.href,
    handle: displayHandle,
    name: actor.name?.toString() ?? username ?? displayHandle,
    summary: htmlToText(actor.summary?.toString() ?? "").slice(0, 280),
    iconUrl,
    url: actor.url instanceof URL ? actor.url.href : actor.id.href,
  };
}

/**
 * Suit un acteur distant identifié par son handle (@user@host) ou son URI :
 * résolution WebFinger, cache de l'acteur, relation `pending`, émission d'un
 * `Follow`. La relation passera `accepted` à réception de l'`Accept` (inbox).
 */
export async function followRemoteActor(
  localHandle: string,
  localUserId: string,
  target: string,
): Promise<RemoteFollowResult> {
  await ensureFederationStorage();
  const ctx = context();
  const handle = target.trim().replace(/^@/, "");

  let actor;
  try {
    actor = await ctx.lookupObject(handle);
  } catch {
    // error = clé i18n (dict.errors), traduite au rendu par l'action.
    return { ok: false, error: "remoteAccountNotFound" };
  }
  if (!isActor(actor) || actor.id == null || actor.inboxId == null) {
    return { ok: false, error: "notAnAccount" };
  }

  await db
    .insert(remoteActors)
    .values({
      uri: actor.id.href,
      handle: handle.includes("@") ? `@${handle}` : null,
      name: actor.name?.toString() ?? null,
      inboxUrl: actor.inboxId.href,
      sharedInboxUrl: actor.endpoints?.sharedInbox?.href ?? null,
      url: actor.url instanceof URL ? actor.url.href : null,
    })
    .onConflictDoUpdate({
      target: remoteActors.uri,
      set: {
        inboxUrl: actor.inboxId.href,
        name: actor.name?.toString() ?? null,
        fetchedAt: new Date(),
      },
    });

  await db
    .insert(follows)
    .values({
      followerUri: actorUri(localHandle),
      followingUri: actor.id.href,
      followerUserId: localUserId,
      status: "pending",
    })
    .onConflictDoNothing();

  await ctx.sendActivity(
    { identifier: localHandle },
    actor,
    new Follow({
      id: new URL(
        `${actorUri(localHandle)}#follows/${encodeURIComponent(actor.id.href)}`,
      ),
      actor: ctx.getActorUri(localHandle),
      object: actor.id,
    }),
  );

  // Backfill immédiat de l'historique récent via l'outbox public : le fil se
  // remplit sans attendre une future publication poussée. Best-effort — un échec
  // ne doit pas faire échouer l'abonnement (déjà persisté + Follow émis).
  try {
    await backfillRemoteOutbox(ctx, actor);
  } catch (err) {
    console.error("Échec du backfill de l'outbox distant :", err);
  }

  return { ok: true };
}

/** Cesse de suivre un acteur distant : `Undo(Follow)` + suppression locale. */
export async function unfollowRemoteActor(
  localHandle: string,
  remoteUri: string,
): Promise<void> {
  await ensureFederationStorage();
  const ctx = context();
  const actor = await ctx.lookupObject(remoteUri).catch(() => null);

  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerUri, actorUri(localHandle)),
        eq(follows.followingUri, remoteUri),
      ),
    );

  if (isActor(actor) && actor.id != null) {
    await ctx.sendActivity(
      { identifier: localHandle },
      actor,
      new Undo({
        actor: ctx.getActorUri(localHandle),
        object: new Follow({
          actor: ctx.getActorUri(localHandle),
          object: actor.id,
        }),
      }),
    );
  }
}
