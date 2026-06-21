import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { onboardingPackItems, onboardingPacks } from "@/db/schema";

/**
 * Packs de départ de l'onboarding, curatés en admin (cf. ADR 0006). Helpers de
 * lecture partagés entre l'admin (`/admin/onboarding`) et l'étape « Ton fil »
 * du wizard. Les mutations vivent dans `src/app/actions/onboarding-packs.ts`.
 */

export type OnboardingItemType = "marge" | "fediverse" | "rss" | "youtube";

export interface PackItemView {
  id: string;
  type: OnboardingItemType;
  label: string;
  ref: string;
}

export interface PackView {
  id: string;
  name: string;
  tag: string;
  enabled: boolean;
  items: PackItemView[];
}

function toView(pack: {
  id: string;
  name: string;
  tag: string;
  enabled: boolean;
  items: { id: string; type: string; label: string; ref: string }[];
}): PackView {
  return {
    id: pack.id,
    name: pack.name,
    tag: pack.tag,
    enabled: pack.enabled,
    items: pack.items.map((i) => ({
      id: i.id,
      type: i.type as OnboardingItemType,
      label: i.label,
      ref: i.ref,
    })),
  };
}

/** Tous les packs (admin), ordonnés, avec leurs items. */
export async function listPacksWithItems(): Promise<PackView[]> {
  const rows = await db.query.onboardingPacks.findMany({
    orderBy: [asc(onboardingPacks.position), asc(onboardingPacks.createdAt)],
    with: {
      items: { orderBy: [asc(onboardingPackItems.position), asc(onboardingPackItems.createdAt)] },
    },
  });
  return rows.map(toView);
}

/** Packs **activés et non vides** pour l'onboarding (étape « Ton fil »). */
export async function listEnabledPacks(): Promise<PackView[]> {
  const all = await listPacksWithItems();
  return all.filter((p) => p.enabled && p.items.length > 0);
}

/** Un pack avec ses items (éditeur admin), ou null. */
export async function getPack(id: string): Promise<PackView | null> {
  const row = await db.query.onboardingPacks.findFirst({
    where: eq(onboardingPacks.id, id),
    with: {
      items: { orderBy: [asc(onboardingPackItems.position), asc(onboardingPackItems.createdAt)] },
    },
  });
  return row ? toView(row) : null;
}
