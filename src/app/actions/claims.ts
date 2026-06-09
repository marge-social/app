"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  blocklist,
  feedClaims,
  feedItems,
  feedSubscriptions,
  feeds,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { crawlerUserAgent } from "@/lib/rss";

export interface OwnershipState {
  error?: string;
  token?: string;
  claimId?: string;
  type?: "claim" | "opt_out";
}

function newToken(): string {
  return `marge-verify-${randomBytes(16).toString("hex")}`;
}

/**
 * Flux de propriété (réclamation / opt-out) en deux temps via `intent` :
 * - "claim-request" / "optout-request" : génère un jeton à insérer dans le flux ;
 * - "verify" : récupère le flux et valide la présence du jeton, puis applique.
 * Preuve de contrôle commune (cf. F3 — non négociable).
 */
export async function feedOwnershipAction(
  _prev: OwnershipState,
  formData: FormData,
): Promise<OwnershipState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const intent = formData.get("intent");
  const feedId = formData.get("feedId") as string;
  if (!feedId) return { error: "feedUnknown" };

  const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
  if (!feed || feed.ownershipStatus === "opt_out") {
    return { error: "feedNotFound" };
  }

  // --- Étape 1 : demande (génère un jeton) ---
  if (intent === "claim-request" || intent === "optout-request") {
    const type = intent === "claim-request" ? "claim" : "opt_out";
    if (type === "claim" && feed.ownershipStatus === "claimed") {
      return { error: "feedHasOwner" };
    }
    const token = newToken();
    const [claim] = await db
      .insert(feedClaims)
      .values({
        feedId,
        claimantId: user.id,
        type,
        verificationMethod: "token",
        token,
        status: "pending",
      })
      .returning({ id: feedClaims.id });
    return { token, claimId: claim.id, type };
  }

  // --- Étape 2 : vérification ---
  if (intent === "verify") {
    const claimId = formData.get("claimId") as string;
    const claim = await db.query.feedClaims.findFirst({
      where: and(
        eq(feedClaims.id, claimId),
        eq(feedClaims.feedId, feedId),
        eq(feedClaims.claimantId, user.id),
      ),
    });
    if (!claim) return { error: "requestNotFound" };

    // Récupère le flux à la source et cherche le jeton.
    let found = false;
    try {
      const res = await fetch(feed.feedUrl, {
        headers: { "User-Agent": crawlerUserAgent(feed.id) },
        redirect: "follow",
      });
      const text = await res.text();
      found = text.includes(claim.token);
    } catch {
      return {
        error: "cannotFetchFeed",
        token: claim.token,
        claimId: claim.id,
        type: claim.type,
      };
    }

    if (!found) {
      return {
        error: "tokenNotFound",
        token: claim.token,
        claimId: claim.id,
        type: claim.type,
      };
    }

    await db
      .update(feedClaims)
      .set({ status: "verified", verifiedAt: new Date() })
      .where(eq(feedClaims.id, claim.id));

    if (claim.type === "claim") {
      // Réclamation validée → flux réclamé, propriété renseignée.
      await db
        .update(feeds)
        .set({ ownerId: user.id, ownershipStatus: "claimed" })
        .where(eq(feeds.id, feedId));
      revalidatePath(`/feeds/${feedId}`);
      revalidatePath(`/@${user.handle}`);
      return {};
    }

    // Opt-out validé → dé-référencement complet + Blocklist.
    // On bloque l'URL EXACTE du flux (pas le domaine) : bloquer le domaine
    // sur-bloquerait les hébergeurs multi-tenant (substack.com, wordpress.com…).
    // Le blocage par domaine reste possible manuellement pour un abus avéré.
    await db
      .insert(blocklist)
      .values({ value: feed.feedUrl, kind: "url", reason: "opt-out vérifié" })
      .onConflictDoNothing();
    // Supprime abonnements, items et le flux (cascade sur feed_claims/items/subs).
    await db.delete(feedSubscriptions).where(eq(feedSubscriptions.feedId, feedId));
    await db.delete(feedItems).where(eq(feedItems.feedId, feedId));
    await db.delete(feeds).where(eq(feeds.id, feedId));
    revalidatePath("/");
    redirect("/");
  }

  return { error: "unknownAction" };
}

/** Le propriétaire (flux réclamé) active/désactive le texte intégral. */
export async function toggleFullTextAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const feedId = formData.get("feedId") as string;
  const feed = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) });
  if (!feed || feed.ownerId !== user.id) return;
  await db
    .update(feeds)
    .set({ fullTextAllowed: !feed.fullTextAllowed })
    .where(eq(feeds.id, feedId));
  revalidatePath(`/feeds/${feedId}`);
}
