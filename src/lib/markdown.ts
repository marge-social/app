import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: false });

/** Convertit du Markdown en HTML sanitisé (sûr à injecter via dangerouslySet). */
export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    // Liens externes ouverts proprement ; pas de scripts.
    ADD_ATTR: ["target", "rel"],
  });
}

/** Texte brut approximatif (pour résumé / temps de lecture), sans balises. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Résumé : reprend un résumé fourni, sinon dérive un chapô honnête du premier
 * paragraphe (tronqué proprement). Sert de `summary` AP et d'aperçu de feed.
 */
export function deriveSummary(
  markdown: string,
  provided?: string,
  maxLen = 280,
): string {
  const explicit = provided?.trim();
  if (explicit) return explicit;
  const text = htmlToText(renderMarkdown(markdown));
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen).trim()}…`;
}

/** Temps de lecture estimé en minutes (≈ 200 mots/min), au moins 1. */
export function readingTimeMinutes(markdown: string): number {
  const words = htmlToText(renderMarkdown(markdown)).split(/\s+/).filter(Boolean)
    .length;
  return Math.max(1, Math.round(words / 200));
}

/** Slug stable : minuscules, sans accents, alphanumérique + tirets. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "texte";
}
