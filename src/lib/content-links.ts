/**
 * Transforme, à l'affichage, les liens sortants d'un contenu HTML sanitisé en
 * « cartouches » compactes (cf. fil d'actualité) plutôt que des URL nues.
 *
 * Règles (présentation, pas de réseau — déterministe) :
 *   1. une flèche ↗ signale un lien sortant ;
 *   2. on affiche le **titre** du lien quand il est accessible — c.-à-d. quand
 *      l'auteur a écrit `[titre](url)` (le texte du lien diffère de l'URL) ;
 *   3. sinon (URL nue auto-liée), on affiche le **domaine**.
 *
 * Ne touche qu'aux liens absolus http(s) (sortants). Les liens internes /
 * relatifs (mentions, permaliens) gardent leur rendu normal. Le HTML d'entrée
 * étant déjà sanitisé, on se contente de réécrire la balise `<a>`.
 */

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

function getAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3] ?? "") : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function normalizeUrl(s: string): string {
  return s
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function domainOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, "");
  } catch {
    return normalizeUrl(href);
  }
}

/** Réécrit les liens sortants d'un HTML sanitisé en cartouches. */
export function cartoucheLinks(html: string): string {
  if (!html) return html;
  return html.replace(ANCHOR_RE, (full, attrs: string, inner: string) => {
    const href = getAttr(attrs, "href");
    // Liens sortants uniquement ; on laisse les liens internes/relatifs.
    if (!href || !/^https?:\/\//i.test(href)) return full;
    // Lien-image : on préserve le rendu original (pas de cartouche).
    if (/<img\b/i.test(inner)) return full;

    const text = stripTags(inner);
    const bare = text === "" || normalizeUrl(text) === normalizeUrl(href);
    const label = bare ? domainOf(href) : text;
    // Maquette : titre → étiquette titrée ; sinon → puce de domaine (variante).
    const cls = bare ? "link-chip link-chip--domain" : "link-chip";

    // On conserve les attributs d'origine (href, target, rel) et on ajoute la
    // classe + un title pour le label complet (visuellement tronqué en CSS).
    const baseAttrs = attrs.replace(/\sclass\s*=\s*("[^"]*"|'[^']*')/i, "");
    return (
      `<a${baseAttrs} class="${cls}" title="${escapeHtml(label)}">` +
      `<span class="link-chip__arrow" aria-hidden="true">↗</span>` +
      `<span class="link-chip__label">${escapeHtml(label)}</span>` +
      `</a>`
    );
  });
}
