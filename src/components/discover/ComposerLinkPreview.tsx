"use client";

import type { LinkPreview } from "@/db/schema";
import { useT } from "@/components/I18nProvider";
import {
  LinkCardInner,
  domainColor,
  domainInitial,
} from "@/components/LinkCard";

/** Sentinelle « aucune vignette » (choix explicite de l'utilisateur). */
export const NONE_KEY = "__none__";

/**
 * Extraction des URL d'un texte — miroir client de `extractUrls` (lib/og,
 * server-only) : URL http(s) explicites, ponctuation finale détachée,
 * dé-doublonnées. Les deux doivent rester alignés (le serveur re-valide que
 * l'URL choisie est bien dans le texte).
 */
export function extractUrlsClient(text: string): string[] {
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

export interface LinkCandidate {
  url: string;
  /** Aperçu résolu ; undefined = récupération en cours. */
  preview: LinkPreview | undefined;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const NoneIcon = (
  <svg
    viewBox="0 0 18 18"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
    <path d="m4 14 4-4 2 2" />
    <circle cx="6.5" cy="7" r="1.1" />
    <path d="M3 3l12 12" />
  </svg>
);
const CheckIcon = (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
);

/** Mini-vignette d'un candidat du sélecteur (image OG ou tuile-lettre). */
function CandThumb({ c }: { c: LinkCandidate }) {
  const domain = c.preview?.domain ?? hostnameOf(c.url);
  if (c.preview?.imageUrl) {
    return (
      <span className="cct">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.preview.imageUrl} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="cct is-letter" style={{ background: domainColor(domain) }}>
      <span className="lt">{domainInitial(domain)}</span>
    </span>
  );
}

/** Squelette de chargement de la vignette mise en avant. */
function Skeleton() {
  return (
    <div className="cmp-link cmp-rich">
      <div className="cmp-rimg cmp-shim"></div>
      <div className="cmp-rbody">
        <div className="cmp-shim cmp-skline" style={{ width: 84, height: 9 }} />
        <div
          className="cmp-shim cmp-skline"
          style={{ width: "92%", height: 13, marginTop: 4 }}
        />
        <div className="cmp-shim cmp-skline" style={{ width: "66%", height: 13 }} />
        <div
          className="cmp-shim cmp-skline"
          style={{ width: "96%", height: 10, marginTop: 7 }}
        />
      </div>
    </div>
  );
}

/**
 * Aperçu de lien du composer (design « Home Visiteur ») : la vignette du lien
 * mis en avant s'affiche en carte riche (✕ pour la retirer) ; avec plusieurs
 * liens, un sélecteur replié (« N liens ▾ ») propose de changer de vignette ou
 * de n'en garder aucune. Présentation pure — l'état vit dans le composer.
 */
export function ComposerLinkPreview({
  links,
  selectedKey,
  onPick,
  onNone,
  onRestore,
  railOpen,
  setRailOpen,
}: {
  links: LinkCandidate[];
  selectedKey: string | null;
  onPick: (url: string) => void;
  onNone: () => void;
  onRestore: () => void;
  railOpen: boolean;
  setRailOpen: (open: boolean) => void;
}) {
  const { t, interpolate } = useT();
  const c = t.composer;
  const multi = links.length > 1;
  const noneSel = selectedKey === NONE_KEY;
  const featured = links.find((l) => l.url === selectedKey);

  return (
    <div className="cmp-lp">
      {noneSel ? (
        <div className="cmp-restore">
          <span style={{ display: "inline-flex", color: "var(--ink-4)" }}>
            {NoneIcon}
          </span>
          <span>{c.noVignette}</span>
          <button
            type="button"
            className="rbtn"
            onClick={() => (multi ? setRailOpen(true) : onRestore())}
          >
            {multi ? c.chooseLink : c.showPreview}
          </button>
        </div>
      ) : featured ? (
        featured.preview === undefined ? (
          <Skeleton />
        ) : (
          <div className="cmp-link cmp-rich">
            <LinkCardInner p={featured.preview} />
            <button
              type="button"
              className="cmp-x cmp-x-abs"
              onClick={onNone}
              aria-label={c.removeVignette}
              title={c.removeVignette}
            >
              ✕
            </button>
          </div>
        )
      ) : null}

      {multi && !noneSel && (
        <div className="cmp-choose">
          <button
            type="button"
            className="cmp-change"
            data-on={railOpen}
            onClick={() => setRailOpen(!railOpen)}
          >
            {interpolate(c.nLinks, { n: links.length })}{" "}
            <span className="chev">▾</span>
          </button>
          <span className="cmp-choose-hint">{c.chooseVignetteHint}</span>
        </div>
      )}

      {multi && railOpen && (
        <div className="cmp-rail" role="radiogroup" aria-label={c.chooseVignetteAria}>
          {links.map((l) => {
            const on = selectedKey === l.url;
            const domain = l.preview?.domain ?? hostnameOf(l.url);
            return (
              <button
                key={l.url}
                type="button"
                className="cmp-cand"
                role="radio"
                data-on={on}
                aria-checked={on}
                onClick={() => onPick(l.url)}
              >
                <CandThumb c={l} />
                <span className="cmeta2">
                  <span className="cdom2">{domain}</span>
                  <span className="cttl2">
                    {l.preview === undefined ? c.loadingPreview : l.preview.title}
                  </span>
                </span>
                <span className="ck2">{CheckIcon}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="cmp-cand none"
            role="radio"
            data-on={noneSel}
            aria-checked={noneSel}
            onClick={onNone}
          >
            <span className="ni2">{NoneIcon}</span>
            <span className="cmeta2">
              <span className="cttl2">{c.noneOption}</span>
            </span>
            <span className="ck2">{CheckIcon}</span>
          </button>
        </div>
      )}
    </div>
  );
}
