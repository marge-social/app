import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAvatars, users } from "@/db/schema";

/**
 * Sert l'avatar d'un compte local, stocké en base (§Lot 5). Servi aussi bien
 * aux navigateurs qu'aux serveurs Fediverse (Person.icon pointe ici).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).replace(/^@/, "").toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(users.handle, handle),
    columns: { id: true },
  });
  if (!user) return new Response("Not found", { status: 404 });

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
