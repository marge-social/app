import Parser from "rss-parser";
import { APP_URL } from "@/lib/config";
import { htmlToText } from "@/lib/markdown";

/**
 * User-Agent du crawler : s'identifie et pointe vers la page publique du flux
 * (réclamation / opt-out). C'est ainsi qu'un blogueur découvre qu'il est
 * référencé (cf. F3 / exigences de consentement).
 */
export function crawlerUserAgent(feedId?: string): string {
  const info = feedId ? `${APP_URL}/feeds/${feedId}` : `${APP_URL}/about`;
  return `Marge/0.1 (+${info}; agrégateur d'intérêt général ; réclamation/opt-out sur cette page)`;
}

function looksLikeFeed(text: string, contentType: string | null): boolean {
  if (contentType && /(xml|rss|atom)/i.test(contentType)) return true;
  const head = text.slice(0, 512).trimStart().toLowerCase();
  return (
    head.startsWith("<?xml") ||
    head.includes("<rss") ||
    head.includes("<feed")
  );
}

/** Extrait l'URL de flux d'une page HTML via <link rel="alternate">. */
function extractFeedLink(html: string, baseUrl: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const candidates: { href: string; isRss: boolean }[] = [];
  for (const tag of linkTags) {
    if (!/rel=["']?alternate["']?/i.test(tag)) continue;
    const type = tag.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (!/(rss|atom)\+xml/.test(type)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    candidates.push({ href, isRss: type.includes("rss") });
  }
  if (candidates.length === 0) return null;
  // Préférence RSS puis Atom (ordre stable).
  const chosen = candidates.find((c) => c.isRss) ?? candidates[0];
  return new URL(chosen.href, baseUrl).href;
}

/**
 * Résout l'URL de flux à partir d'une URL fournie : si c'est déjà un flux on le
 * renvoie, sinon on auto-découvre via la page HTML. Lance si rien trouvé.
 */
export async function discoverFeedUrl(input: string): Promise<string> {
  const url = new URL(input).href; // valide l'URL (lance si invalide)
  const res = await fetch(url, {
    headers: { "User-Agent": crawlerUserAgent(), Accept: "*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Réponse ${res.status} pour ${url}`);
  const contentType = res.headers.get("content-type");
  const text = await res.text();

  if (looksLikeFeed(text, contentType)) return res.url || url;

  const discovered = extractFeedLink(text, res.url || url);
  if (!discovered) {
    // Message = clé i18n (cf. dict.errors) : l'action référence la traduit.
    throw new Error("noFeedFound");
  }
  return discovered;
}

export interface FeedPreview {
  feedUrl: string;
  title: string;
  description: string;
  itemCount: number;
}

/**
 * Auto-découvre et parse un flux à partir d'une URL pour l'AFFICHER dans la
 * recherche (sans rien persister). Lance si l'adresse ne répond pas par un flux.
 */
export async function previewFeed(input: string): Promise<FeedPreview> {
  const feedUrl = await discoverFeedUrl(input);
  const parsed = await parseFeed(feedUrl);
  return {
    feedUrl,
    title: parsed.title,
    description: parsed.description,
    itemCount: parsed.items.length,
  };
}

export interface ParsedFeed {
  title: string;
  description: string;
  items: ParsedFeedItem[];
}

export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  author: string | null;
  excerpt: string;
  contentHtml: string | null;
  /** Image d'aperçu détectée dans le flux (null si rien ; og:image en repli). */
  imageUrl: string | null;
  publishedAt: Date | null;
}

/** Résout une URL (possiblement relative) en absolue http(s), sinon null. */
function absoluteHttpUrl(raw: string, baseUrl: string): string | null {
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const abs = new URL(raw, baseUrl || undefined).href;
    return /^https?:\/\//i.test(abs) ? abs : null;
  } catch {
    return null;
  }
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;

/**
 * Extrait la première image d'un fragment HTML (ex. contenu stocké d'un item),
 * résolue en URL absolue http(s). Réutilisé par la détection et le backfill.
 */
export function firstImageInHtml(
  html: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!html) return null;
  const match = /<img\b[^>]*?\bsrc=["']([^"']+)["']/i.exec(html);
  return match ? absoluteHttpUrl(match[1], baseUrl) : null;
}

/** Aplatit une valeur rss-parser (objet, tableau, ou rien) en tableau. */
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Lit l'attribut `url` d'un nœud Media RSS (xml2js le pose sous `$`). */
function mediaNodeUrl(node: unknown): {
  url?: string;
  type?: string;
  medium?: string;
} {
  if (!node || typeof node !== "object") return {};
  const attrs = ("$" in node ? (node as { $: unknown }).$ : node) as
    | Record<string, string>
    | undefined;
  return attrs ?? {};
}

/**
 * Détecte l'image d'aperçu la plus pertinente d'un item de flux, sans réseau, par
 * ordre de fiabilité décroissant : Media RSS (`media:content`/`media:thumbnail`,
 * y compris dans un `media:group`), `enclosure` image, image iTunes, puis le
 * premier `<img>` du contenu HTML. URL résolue en absolue (jamais réhébergée).
 */
function detectInlineImage(
  it: Record<string, unknown>,
  baseUrl: string,
): string | null {
  // 1. Media RSS : media:content (+ ceux d'un éventuel media:group).
  const candidates: unknown[] = [...asArray(it.mediaContent)];
  const group = it.mediaGroup as Record<string, unknown> | undefined;
  if (group) candidates.push(...asArray(group["media:content"]));
  for (const cand of candidates) {
    const { url, type, medium } = mediaNodeUrl(cand);
    if (!url) continue;
    const isImage =
      medium === "image" ||
      (type ? type.startsWith("image/") : IMAGE_EXT_RE.test(url));
    if (isImage) {
      const abs = absoluteHttpUrl(url, baseUrl);
      if (abs) return abs;
    }
  }

  // 2. media:thumbnail.
  for (const thumb of asArray(it.mediaThumbnail)) {
    const { url } = mediaNodeUrl(thumb);
    if (url) {
      const abs = absoluteHttpUrl(url, baseUrl);
      if (abs) return abs;
    }
  }

  // 3. enclosure (rss-parser : { url, type, length }).
  const enclosure = it.enclosure as
    | { url?: string; type?: string }
    | undefined;
  if (enclosure?.url) {
    const isImage = enclosure.type
      ? enclosure.type.startsWith("image/")
      : IMAGE_EXT_RE.test(enclosure.url);
    if (isImage) {
      const abs = absoluteHttpUrl(enclosure.url, baseUrl);
      if (abs) return abs;
    }
  }

  // 4. Image iTunes (podcasts & certains blogs).
  const itunes = it.itunes as { image?: string } | undefined;
  if (itunes?.image) {
    const abs = absoluteHttpUrl(itunes.image, baseUrl);
    if (abs) return abs;
  }

  // 5. Premier <img> du contenu HTML.
  const html =
    (it["content:encoded"] as string | undefined) ??
    (it.content as string | undefined) ??
    "";
  return firstImageInHtml(html, baseUrl);
}

/** Cherche une image og:image / twitter:image dans le <head> d'une page HTML. */
function extractMetaImage(html: string): string | null {
  let twitter: string | null = null;
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

/**
 * Repli réseau : récupère l'image de partage (og:image, sinon twitter:image)
 * déclarée par la page de l'article. C'est « l'image la plus pertinente probable »
 * choisie par l'éditeur. Best-effort, borné en temps ; null en cas d'échec.
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": crawlerUserAgent(),
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    if (!/html/i.test(res.headers.get("content-type") ?? "")) return null;
    // Le <head> suffit : on ne lit qu'un préfixe raisonnable.
    const html = (await res.text()).slice(0, 100_000);
    const found = extractMetaImage(html);
    return found ? absoluteHttpUrl(found, res.url || pageUrl) : null;
  } catch {
    return null;
  }
}

/** Extrait honnête : snippet fourni, sinon texte du contenu, tronqué. */
function buildExcerpt(
  snippet: string | undefined,
  content: string | undefined,
  maxLen = 320,
): string {
  const raw = (snippet ?? (content ? htmlToText(content) : "")).trim();
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim()}…`;
}

/** Récupère et parse un flux. `feedId` sert à l'identification du crawler. */
export async function parseFeed(
  feedUrl: string,
  feedId?: string,
): Promise<ParsedFeed> {
  const parser = new Parser({
    headers: { "User-Agent": crawlerUserAgent(feedId) },
    timeout: 15000,
    // Champs Media RSS (namespace media:) pour la détection d'image d'aperçu.
    customFields: {
      item: [
        ["media:content", "mediaContent", { keepArray: true }],
        ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
        ["media:group", "mediaGroup"],
      ],
    },
  });
  const feed = await parser.parseURL(feedUrl);
  const items: ParsedFeedItem[] = (feed.items ?? []).map((it) => {
    // `customFields` restreint le type d'Item ; on relit en sac dynamique pour
    // les champs hors-schéma (author, content:encoded, media:*).
    const raw = it as unknown as Record<string, unknown>;
    const link = it.link ?? "";
    const dateStr = it.isoDate ?? it.pubDate;
    return {
      // GUID stable pour le dé-doublonnage : guid sinon lien sinor titre.
      guid: it.guid ?? link ?? it.title ?? "",
      title: it.title ?? "(sans titre)",
      link,
      author:
        it.creator ?? (raw.author as string | undefined) ?? null,
      excerpt: buildExcerpt(it.contentSnippet, it.content),
      contentHtml:
        (raw["content:encoded"] as string | undefined) ?? it.content ?? null,
      imageUrl: detectInlineImage(raw, link || feedUrl),
      publishedAt: dateStr ? new Date(dateStr) : null,
    };
  });
  return {
    title: feed.title ?? feedUrl,
    description: feed.description ?? "",
    items: items.filter((i) => i.guid && i.link),
  };
}
