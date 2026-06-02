import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feedSubscriptions, feeds } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Export OPML des abonnements RSS de l'utilisateur (portabilité des données). */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rows = await db
    .select({ title: feeds.title, feedUrl: feeds.feedUrl })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feeds.id, feedSubscriptions.feedId))
    .where(eq(feedSubscriptions.userId, user.id));

  const outlines = rows
    .map((r) => {
      const title = escapeXml(r.title || r.feedUrl);
      const url = escapeXml(r.feedUrl);
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}" htmlUrl="${url}" />`;
    })
    .join("\n");

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Abonnements RSS de ${escapeXml(fediverseHandle(user.handle))} — Marge</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;

  return new Response(opml, {
    headers: {
      "Content-Type": "text/x-opml; charset=utf-8",
      "Content-Disposition": `attachment; filename="marge-${user.handle}-abonnements.opml"`,
    },
  });
}
