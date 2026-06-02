import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { articles, users } from "../src/db/schema";
import {
  buildCreateForArticle,
  federation,
} from "../src/federation/federation";
import { APP_URL } from "../src/lib/config";

async function main() {
  const user = await db.query.users.findFirst({
    where: eq(users.handle, "marc"),
  });
  if (!user) throw new Error("user marc introuvable");
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.authorId, user.id), eq(articles.status, "published")),
  });
  if (!article) throw new Error("aucun article publié");

  const ctx = federation.createContext(new URL(APP_URL), undefined);
  const create = buildCreateForArticle(ctx, "marc", article);
  const jsonld = (await create.toJsonLd({ format: "compact" })) as Record<
    string,
    unknown
  >;

  const obj = jsonld.object as Record<string, unknown>;
  console.log("Activity type :", jsonld.type);
  console.log("Activity actor:", jsonld.actor);
  console.log("Activity to   :", jsonld.to);
  console.log("Activity cc   :", jsonld.cc);
  console.log("Object type   :", obj.type);
  console.log("Object id     :", obj.id);
  console.log("Object name   :", obj.name);
  console.log("Object url    :", obj.url);
  console.log("Object summary:", String(obj.summary).slice(0, 60), "…");
  const ok =
    jsonld.type === "Create" &&
    obj.type === "Article" &&
    String(jsonld.to).includes("Public") &&
    typeof obj.content === "string";
  console.log(ok ? "\nPayload Create(Article) VALIDE ✅" : "\nPayload INVALIDE ❌");
  await sql.end();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
