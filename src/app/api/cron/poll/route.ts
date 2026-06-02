import { NextResponse } from "next/server";
import { pollAllFeeds } from "@/lib/poll";

/**
 * Endpoint de polling RSS mutualisé, déclenché par une tâche cron.
 * Protégé par CRON_SECRET (header `Authorization: Bearer <secret>` ou
 * `?secret=`).
 */
async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await pollAllFeeds();
  const newItems = results.reduce((n, r) => n + r.newItems, 0);
  return NextResponse.json({
    polled: results.length,
    newItems,
    errors: results.filter((r) => !r.ok).length,
    results,
  });
}

export const GET = handle;
export const POST = handle;
