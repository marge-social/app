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
    throw new Error("Aucun flux RSS/Atom trouvé à cette adresse.");
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
  publishedAt: Date | null;
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
  });
  const feed = await parser.parseURL(feedUrl);
  const items: ParsedFeedItem[] = (feed.items ?? []).map((it) => {
    const link = it.link ?? "";
    const dateStr = it.isoDate ?? it.pubDate;
    return {
      // GUID stable pour le dé-doublonnage : guid sinon lien sinor titre.
      guid: it.guid ?? link ?? it.title ?? "",
      title: it.title ?? "(sans titre)",
      link,
      author: it.creator ?? it.author ?? null,
      excerpt: buildExcerpt(it.contentSnippet, it.content),
      contentHtml: it["content:encoded"] ?? it.content ?? null,
      publishedAt: dateStr ? new Date(dateStr) : null,
    };
  });
  return {
    title: feed.title ?? feedUrl,
    description: feed.description ?? "",
    items: items.filter((i) => i.guid && i.link),
  };
}
