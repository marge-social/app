import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/og";

/**
 * Aperçu Open Graph d'un lien, pour la vignette du composer (`?url=`).
 * Réservé aux utilisateurs connectés (pas de proxy ouvert) ; la valeur
 * persistée à la publication est re-résolue côté serveur de toute façon
 * (le client ne fournit jamais le contenu de la vignette).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get("url") ?? "";
  const preview = await fetchLinkPreview(url);
  if (!preview) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }
  return NextResponse.json(preview);
}
