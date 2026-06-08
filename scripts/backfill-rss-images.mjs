// Backfill des images d'aperçu pour les items RSS déjà en base (antérieurs à
// l'ajout de `feed_items.image_url`). Pour chaque item sans image :
//   1. première image du contenu HTML stocké (si `full_text_allowed` l'a gardé) ;
//   2. sinon repli og:image / twitter:image en récupérant la page de l'item.
//
// URL distante, jamais réhébergée (cf. F3). Best-effort, idempotent (re-jouable :
// ne touche que les items encore sans image).
//
// N'utilise que des dépendances de production (`postgres`), comme migrate.mjs /
// make-admin.mjs — les helpers purs de src/lib/rss.ts sont réimplémentés ici car
// les alias `@/` et `server-only` ne sont pas résolvables hors Next.
//
// Usage :
//   docker compose exec app node scripts/backfill-rss-images.mjs --dry-run
//   docker compose exec app node scripts/backfill-rss-images.mjs
//   docker compose exec app node scripts/backfill-rss-images.mjs --limit=200
import postgres from "postgres";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split("=")[1], 10)) : 0;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant — backfill impossible.");
  process.exit(1);
}

// User-Agent du crawler, aligné sur src/lib/rss.ts (s'identifie et pointe vers
// la page publique d'opt-out/réclamation).
const APP_URL = (process.env.APP_URL ?? "https://marge.social").replace(
  /\/+$/,
  "",
);
const USER_AGENT = `Marge/0.1 (+${APP_URL}/about; agrégateur d'intérêt général ; réclamation/opt-out sur cette page)`;

/** Résout une URL (possiblement relative) en absolue http(s), sinon null. */
function absoluteHttpUrl(raw, baseUrl) {
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const abs = new URL(raw, baseUrl || undefined).href;
    return /^https?:\/\//i.test(abs) ? abs : null;
  } catch {
    return null;
  }
}

/** Première image d'un fragment HTML, résolue en URL absolue http(s). */
function firstImageInHtml(html, baseUrl) {
  if (!html) return null;
  const match = /<img\b[^>]*?\bsrc=["']([^"']+)["']/i.exec(html);
  return match ? absoluteHttpUrl(match[1], baseUrl) : null;
}

/** Cherche og:image / twitter:image dans le <head> d'une page HTML. */
function extractMetaImage(html) {
  let twitter = null;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const prop = tag
      .match(/(?:property|name)=["']([^"']+)["']/i)?.[1]
      ?.toLowerCase();
    if (!prop) continue;
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (!content) continue;
    if (prop === "og:image" || prop === "og:image:url") return content;
    if (prop === "twitter:image" || prop === "twitter:image:src")
      twitter ??= content;
  }
  return twitter;
}

/** Repli réseau : og:image (sinon twitter:image) de la page de l'article. */
async function fetchOgImage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    if (!/html/i.test(res.headers.get("content-type") ?? "")) return null;
    const html = (await res.text()).slice(0, 100_000);
    const found = extractMetaImage(html);
    return found ? absoluteHttpUrl(found, res.url || pageUrl) : null;
  } catch {
    return null;
  }
}

const sql = postgres(url, { max: 1 });
try {
  const rows = await sql`
    SELECT id, link, content_html
    FROM feed_items
    WHERE image_url IS NULL
    ORDER BY fetched_at
  `;
  const targets = limit > 0 ? rows.slice(0, limit) : rows;
  console.log(
    `${rows.length} item(s) sans image — traitement de ${targets.length}` +
      (dryRun ? " (dry-run)" : ""),
  );

  let fromHtml = 0;
  let fromOg = 0;
  let none = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const item = targets[i];
    // 1. Image inline du contenu stocké (gratuit, sans réseau).
    let image = firstImageInHtml(item.content_html, item.link);
    let origin = "html";
    // 2. Sinon repli réseau sur la page de l'item.
    if (!image && item.link) {
      image = await fetchOgImage(item.link);
      origin = "og";
    }

    if (!image) {
      none += 1;
    } else {
      if (origin === "html") fromHtml += 1;
      else fromOg += 1;
      if (!dryRun) {
        await sql`UPDATE feed_items SET image_url = ${image} WHERE id = ${item.id}`;
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === targets.length) {
      console.log(
        `  …${i + 1}/${targets.length} (html=${fromHtml}, og=${fromOg}, aucune=${none})`,
      );
    }
  }

  console.log(
    `\nTerminé : ${fromHtml} via contenu, ${fromOg} via og:image, ${none} sans image trouvée.`,
  );
} catch (err) {
  console.error("✗ Échec du backfill :", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
