import { NextResponse } from "next/server";
import { runDigest } from "@/lib/digest";

/**
 * Déclenche le moteur de digest (§4.3) : regroupe les signaux pauvres en file
 * en notifications « N personnes ont … ». À brancher sur une tâche cron à la
 * cadence voulue (quotidien par défaut). Protégé par CRON_SECRET (header
 * `Authorization: Bearer <secret>` ou `?secret=`), comme le polling RSS.
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

  const result = await runDigest();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
