import { NextResponse } from "next/server";
import { runSignupMaintenance } from "@/lib/signups";

/**
 * Maintenance des inscriptions non activées, déclenchée par une tâche cron
 * (cf. ADR 0006). Envoie le rappel à 48 h puis supprime à 96 h les inscriptions
 * jamais activées. Protégé par CRON_SECRET (header `Authorization: Bearer
 * <secret>` ou `?secret=`), comme les autres endpoints cron.
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

  const result = await runSignupMaintenance();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
