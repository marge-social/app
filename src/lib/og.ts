import type { LinkPreview } from "@/db/schema";
import { crawlerUserAgent } from "@/lib/rss";

/**
 * Résolution d'aperçu Open Graph pour la vignette de lien du composer.
 *
 * Va chercher la page et lit ses balises `og:*` (replis `twitter:*` puis
 * `<title>`). Best-effort et borné (timeout, préfixe HTML seulement) ; en cas
 * d'échec on retourne un aperçu **minimal** (domaine seul) plutôt que rien :
 * le lien reste un candidat sélectionnable au composer, simplement sans image
 * ni titre éditorial. `null` n'est rendu que pour une URL invalide ou interdite.
 */

const FETCH_TIMEOUT_MS = 8000;
const HTML_PREFIX = 200_000;

// Cache TTL en mémoire : l'aperçu est demandé au fil de la saisie (API) puis
// à la publication (action serveur) — inutile d'aller chercher deux fois.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; value: LinkPreview | null }>();

/** Garde anti-SSRF minimale : pas d'hôtes locaux/privés évidents. */
function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
    return true;
  }
  return false;
}

/** Valide et normalise l'URL candidate ; null si non http(s) ou interdite. */
export function sanitizeLinkUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isForbiddenHost(url.hostname)) return null;
  return url;
}

/** Décodage minimal des entités HTML des balises meta. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Contenu de la première balise meta correspondant à l'une des clés. */
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(
      `<meta\\s[^>]*(?:property|name)=["']${key}["'][^>]*>`,
      "i",
    );
    const tag = re.exec(html)?.[0];
    if (!tag) continue;
    const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
    if (content?.trim()) return decodeEntities(content.trim());
  }
  return null;
}

function absoluteHttpUrl(raw: string, baseUrl: string): string | null {
  try {
    const abs = new URL(raw, baseUrl);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return abs.href;
  } catch {
    return null;
  }
}

/**
 * Titres typiques des pages de défi anti-bot (Datadome, Cloudflare, Imperva…)
 * servies à notre crawler à la place de l'article. Mieux vaut un aperçu
 * minimal honnête (domaine seul) qu'une carte « Client Challenge ».
 * Détection par titre uniquement : les marqueurs HTML (scripts datadome/cf)
 * apparaissent aussi sur les pages normales des sites protégés.
 */
const CHALLENGE_TITLES = [
  "client challenge",
  "just a moment",
  "attention required",
  "access denied",
  "accès refusé",
  "are you a robot",
  "pardon our interruption",
  "verification required",
  "captcha",
];

function isBotChallengeTitle(title: string): boolean {
  const t = title.toLowerCase();
  return CHALLENGE_TITLES.some((m) => t.includes(m));
}

function minimalPreview(url: URL): LinkPreview {
  return {
    url: url.href,
    domain: url.hostname.replace(/^www\./, ""),
    title: url.hostname.replace(/^www\./, ""),
    description: null,
    imageUrl: null,
    siteName: null,
  };
}

/**
 * Résout l'aperçu d'un lien. Retourne un aperçu minimal (domaine) si la page
 * est injoignable ou muette ; null si l'URL est invalide/interdite.
 */
export async function fetchLinkPreview(
  rawUrl: string,
): Promise<LinkPreview | null> {
  const url = sanitizeLinkUrl(rawUrl);
  if (!url) return null;

  const hit = cache.get(url.href);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let preview = minimalPreview(url);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": crawlerUserAgent(),
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok && /html/i.test(res.headers.get("content-type") ?? "")) {
      const finalUrl = res.url || url.href;
      const html = (await res.text()).slice(0, HTML_PREFIX);
      const title =
        metaContent(html, ["og:title", "twitter:title"]) ??
        decodeEntities(
          /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "",
        );
      const description = metaContent(html, [
        "og:description",
        "twitter:description",
        "description",
      ]);
      const rawImage = metaContent(html, [
        "og:image",
        "og:image:url",
        "twitter:image",
        "twitter:image:src",
      ]);
      // Page de défi anti-bot → on s'en tient à l'aperçu minimal (domaine).
      if (!isBotChallengeTitle(title)) {
        preview = {
          url: url.href,
          domain: new URL(finalUrl).hostname.replace(/^www\./, ""),
          title: title || preview.domain,
          description: description || null,
          imageUrl: rawImage ? absoluteHttpUrl(rawImage, finalUrl) : null,
          siteName: metaContent(html, ["og:site_name"]) || null,
        };
      }
    }
  } catch {
    // injoignable → aperçu minimal
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url.href, { at: Date.now(), value: preview });
  return preview;
}

/**
 * Extraction des URL d'un texte de note — même règle que le composer côté
 * client (URL http(s) explicites, ponctuation finale détachée, dé-doublonnées).
 */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>()]+/gi)) {
    const u = m[0].replace(/[.,;:!?»)\]]+$/, "");
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}
