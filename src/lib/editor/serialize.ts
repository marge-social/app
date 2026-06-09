// src/lib/editor/serialize.ts
// Helpers de l'éditeur d'article (côté client) : conversion Markdown ⇄ HTML pour
// la surface `contentEditable`, calcul des statistiques « miroir » et
// sérialisation des sources en bloc Markdown persistable.
//
// Le stockage de l'article reste du Markdown (sanitisé + fédéré côté serveur) :
// on peuple l'éditeur via `markdownToHtml` à l'ouverture d'un brouillon, et on
// re-sérialise en Markdown via `htmlToMarkdown` à l'enregistrement.

import { marked } from "marked";
import TurndownService from "turndown";

export type EditorFormat = "note" | "billet" | "analyse";

export type SourceKind = "url" | "book" | "article" | "marge";

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  url?: string;
  author?: string;
  year?: string;
  isbn?: string;
  doi?: string;
  venue?: string;
}

export interface EditorStats {
  words: number;
  readingMinutes: number;
  paragraphs: number;
  sourceCount: number;
  hasStructure: boolean;
  hasArgument: boolean;
  hasQuote: boolean;
  hasMargeRef: boolean;
}

/** Clés de suggestion contextuelle (mappées sur dict.editor.suggestions). */
export type SuggestionKey =
  | "enjeu"
  | "noSources"
  | "noMargeRef"
  | "noStructure"
  | "noArgument";

// ── Markdown → HTML (peuplement initial de l'éditeur) ───────────────────────
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

// ── HTML → Markdown (à l'enregistrement) ────────────────────────────────────
// Instance Turndown configurée pour le sous-ensemble produit par la barre
// flottante (gras/italique/H2/H3/citation/liste/lien) + nos appels de note.
let _td: TurndownService | null = null;
function turndown(): TurndownService {
  if (_td) return _td;
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });
  // Appels de note : <sup class="footnote">1</sup> → « [1] » (préservés dans le
  // Markdown ; le bloc « Sources » est appensé séparément à l'enregistrement).
  td.addRule("footnote", {
    filter: (node) =>
      node.nodeName === "SUP" &&
      (node as HTMLElement).classList.contains("footnote"),
    replacement: (content) => `[${content}]`,
  });
  // Médias inline éventuels (non supportés par le backend) : ignorés.
  td.addRule("dropInlineMedia", {
    filter: (node) => {
      const el = node as HTMLElement;
      return (
        el.classList?.contains("media-img") ||
        el.classList?.contains("media-file")
      );
    },
    replacement: () => "",
  });
  _td = td;
  return td;
}

export function htmlToMarkdown(html: string): string {
  return turndown().turndown(html).trim();
}

// ── Statistiques « miroir » ─────────────────────────────────────────────────
// Lit le DOM live du corps + le nombre de sources. Fonction pure (pas d'effet).
export function computeStats(
  bodyEl: HTMLElement | null,
  title: string,
  chapo: string,
  sourceCount: number,
  hasMargeSource: boolean,
): EditorStats {
  const headWords = countWords(`${title || ""} ${chapo || ""}`);
  if (!bodyEl) {
    return {
      words: headWords,
      readingMinutes: Math.max(1, Math.round(headWords / 220)),
      paragraphs: 0,
      sourceCount,
      hasStructure: false,
      hasArgument: false,
      hasQuote: false,
      hasMargeRef: hasMargeSource,
    };
  }
  const bodyText = bodyEl.textContent ?? "";
  const words = countWords(`${title || ""} ${chapo || ""} ${bodyText}`);
  const readingMinutes = Math.max(1, Math.round(words / 220));
  const paragraphs = bodyEl.querySelectorAll("p").length;
  const hasStructure = bodyEl.querySelectorAll("h2, h3").length > 0;
  const hasQuote = bodyEl.querySelectorAll("blockquote").length > 0;
  const argRe =
    /\b(mais|cependant|toutefois|néanmoins|en revanche|or,|pourtant)\b/i;
  const hasArgument = argRe.test(bodyText);
  const hasMargeRef = hasMargeSource || /@[a-zA-ZÀ-ÿ][\w\-.]+/.test(bodyText);
  return {
    words,
    readingMinutes,
    paragraphs,
    sourceCount,
    hasStructure,
    hasArgument,
    hasQuote,
    hasMargeRef,
  };
}

function countWords(text: string): number {
  return (text.match(/\S+/g) || []).length;
}

// ── Suggestion contextuelle (clé unique, du plus fort levier au plus faible) ─
export function pickSuggestion(stats: EditorStats): SuggestionKey | null {
  if (stats.words < 60) return "enjeu";
  if (stats.sourceCount === 0) return "noSources";
  if (!stats.hasMargeRef) return "noMargeRef";
  if (!stats.hasStructure && stats.words > 350) return "noStructure";
  if (!stats.hasArgument && stats.words > 200) return "noArgument";
  return null;
}

// ── Sérialisation des sources en bloc Markdown ──────────────────────────────
// Appensé au contenu à l'enregistrement → persistance via `contentMarkdown`.
// `heading` est fourni (i18n) par l'appelant.
export function serializeSources(sources: Source[], heading: string): string {
  if (sources.length === 0) return "";
  const lines = sources.map((s, i) => `${i + 1}. ${formatSource(s)}`);
  return `\n\n## ${heading}\n\n${lines.join("\n")}\n`;
}

function formatSource(s: Source): string {
  const label = (s.title || s.url || "").trim();
  const bits: string[] = [];
  if (s.author) bits.push(s.author);
  if (s.venue) bits.push(s.venue);
  if (s.year) bits.push(s.year);
  const meta = bits.length ? ` — ${bits.join(", ")}` : "";
  const refs: string[] = [];
  if (s.doi) refs.push(`DOI: ${s.doi}`);
  if (s.isbn) refs.push(`ISBN: ${s.isbn}`);
  const refSuffix = refs.length ? ` (${refs.join(" · ")})` : "";
  // Lien Markdown si une URL est présente.
  if (s.url && s.kind === "url") {
    return `[${label}](${s.url})${meta}${refSuffix}`;
  }
  return `${label}${meta}${refSuffix}`;
}
