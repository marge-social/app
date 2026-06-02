import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { blocklist } from "@/db/schema";

/** Domaine (hostname) d'une URL, en minuscules. */
export function domainOf(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

/**
 * Vrai si l'URL exacte OU son domaine figure dans la Blocklist (opt-out
 * vérifié). Vérifié avant tout (re-)référencement d'un flux.
 */
export async function isBlocked(url: string): Promise<boolean> {
  const domain = domainOf(url);
  const hit = await db.query.blocklist.findFirst({
    where: or(
      and(eq(blocklist.kind, "url"), eq(blocklist.value, url)),
      and(eq(blocklist.kind, "domain"), eq(blocklist.value, domain)),
    ),
    columns: { id: true },
  });
  return !!hit;
}
