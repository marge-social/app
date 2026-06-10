import type { LinkPreview } from "@/db/schema";

/**
 * Carte de lien enrichie (vignette Open Graph) — visuel partagé entre le
 * composer (aperçu sélectionnable) et le fil/la page note (carte cliquable).
 * L'image vient de l'origine distante (`og:image`), jamais re-hébergée —
 * même logique que les images d'items RSS. Repli en tuile-lettre colorée
 * (déterministe par domaine) quand la page n'expose pas d'image.
 */

const PALETTE = ["#1F4E7A", "#3B6E47", "#8B3A1F", "#6A4A86", "#2A2520"];

export function domainColor(domain: string): string {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export function domainInitial(domain: string): string {
  return domain.replace(/^www\./, "").charAt(0).toUpperCase() || "·";
}

/** Intérieur de la carte (image/tuile + domaine, titre, description). */
export function LinkCardInner({ p }: { p: LinkPreview }) {
  const color = domainColor(p.domain);
  return (
    <>
      {p.imageUrl ? (
        <div className="cmp-rimg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt="" loading="lazy" />
        </div>
      ) : (
        <div className="cmp-rimg is-letter" style={{ background: color }}>
          <span className="lt">{domainInitial(p.domain)}</span>
        </div>
      )}
      <div className="cmp-rbody">
        <div className="cmp-rdom">
          <span className="cmp-favic" style={{ background: color }} aria-hidden>
            {domainInitial(p.domain)}
          </span>
          <span className="cmp-rsite">{p.domain}</span>
          {p.siteName && p.siteName !== p.domain && (
            <>
              <span className="cmp-rsep">·</span>
              <span className="cmp-rauth">{p.siteName}</span>
            </>
          )}
        </div>
        <div className="cmp-rtitle">{p.title}</div>
        {p.description && <div className="cmp-rdesc">{p.description}</div>}
      </div>
    </>
  );
}

/** Carte cliquable, telle qu'affichée sous une note dans le fil. */
export function LinkCard({ p }: { p: LinkPreview }) {
  return (
    <a
      className="cmp-link cmp-rich linkcard"
      href={p.url}
      rel="noopener noreferrer nofollow"
      target="_blank"
    >
      <LinkCardInner p={p} />
    </a>
  );
}
