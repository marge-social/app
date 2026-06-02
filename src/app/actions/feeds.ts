"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feedSubscriptions, feeds } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isBlocked } from "@/lib/blocklist";
import { pollFeed } from "@/lib/poll";
import { discoverFeedUrl } from "@/lib/rss";

export interface FeedFormState {
  error?: string;
}

/**
 * Référence un flux : auto-découverte, vérification Blocklist, création en
 * statut « orphelin », polling immédiat, et abonnement du référenceur.
 * Modèle « permissionless mais contestable » (cf. F3).
 */
export async function referenceFeedAction(
  _prev: FeedFormState,
  formData: FormData,
): Promise<FeedFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const input = ((formData.get("url") as string) ?? "").trim();
  if (!input) return { error: "Indique l’URL d’un blog ou d’un flux." };

  let feedUrl: string;
  try {
    feedUrl = await discoverFeedUrl(input);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Impossible de lire cette adresse.",
    };
  }

  if (await isBlocked(feedUrl)) {
    return {
      error:
        "Ce flux a fait l’objet d’un retrait (opt-out) et ne peut pas être référencé.",
    };
  }

  let feedId: string;
  const existing = await db.query.feeds.findFirst({
    where: eq(feeds.feedUrl, feedUrl),
  });

  if (existing) {
    if (existing.ownershipStatus === "opt_out") {
      return { error: "Ce flux a été retiré par son auteur." };
    }
    feedId = existing.id;
  } else {
    const [created] = await db
      .insert(feeds)
      .values({
        feedUrl,
        ownershipStatus: "orphan",
        referencedBy: user.id,
      })
      .returning();
    feedId = created.id;
    // Premier polling immédiat pour peupler le flux.
    await pollFeed(created);
  }

  // Abonnement du référenceur (suivi de flux, indépendant du follow de compte).
  await db
    .insert(feedSubscriptions)
    .values({ userId: user.id, feedId })
    .onConflictDoNothing();

  revalidatePath("/feeds");
  revalidatePath("/feed");
  redirect(`/feeds/${feedId}`);
}

/** Abonne l'utilisateur courant à un flux (FeedSubscription, interne). */
export async function subscribeFeedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const feedId = formData.get("feedId") as string;
  if (!feedId) return;
  await db
    .insert(feedSubscriptions)
    .values({ userId: user.id, feedId })
    .onConflictDoNothing();
  revalidatePath(`/feeds/${feedId}`);
  revalidatePath("/feed");
}

/** Désabonne l'utilisateur courant d'un flux. */
export async function unsubscribeFeedAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const feedId = formData.get("feedId") as string;
  if (!feedId) return;
  await db
    .delete(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, user.id),
        eq(feedSubscriptions.feedId, feedId),
      ),
    );
  revalidatePath(`/feeds/${feedId}`);
  revalidatePath("/feed");
}
