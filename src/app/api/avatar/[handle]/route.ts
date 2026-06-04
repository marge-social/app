import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media, userAvatars, users } from "@/db/schema";

/**
 * Sert l'avatar d'un compte local. Avatar récent → **redirige** (302) vers
 * l'URL publique du média sur le stockage objet (origine séparée, cahier
 * médias). Avatar legacy → octets servis depuis Postgres (§Lot 5). Pointé aussi
 * bien par les navigateurs que par les serveurs Fediverse (Person.icon legacy).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).replace(/^@/, "").toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.handle, handle),
    columns: { id: true, avatarMediaId: true },
  });
  if (!user) return new Response("Not found", { status: 404 });

  // Avatar sur stockage objet : on redirige vers son URL publique stable.
  if (user.avatarMediaId) {
    const row = await db.query.media.findFirst({
      where: eq(media.id, user.avatarMediaId),
      columns: { url: true },
    });
    if (row) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: row.url,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=86400",
        },
      });
    }
  }

  const avatar = await db.query.userAvatars.findFirst({
    where: eq(userAvatars.userId, user.id),
  });
  if (!avatar) return new Response("Not found", { status: 404 });

  // Buffer → ArrayBuffer pour le corps de la réponse.
  const body = new Uint8Array(avatar.data);
  return new Response(body, {
    headers: {
      "Content-Type": avatar.contentType,
      "Content-Length": String(body.byteLength),
      // L'URL n'est pas versionnée ; on autorise un cache court + revalidation.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=86400",
      "Last-Modified": avatar.updatedAt.toUTCString(),
    },
  });
}
