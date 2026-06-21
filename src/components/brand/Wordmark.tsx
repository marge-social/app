import Link from "next/link";

/**
 * Mot-symbole « marge. » — source de vérité de la marque (cf. charte).
 *
 * Rendu en HTML/CSS sémantique (jamais une `<img>` ni un SVG) pour rester
 * recolorable et accessible : Inter Tight 600, approche −0.03em, le mot en encre
 * (`--ink` = neutral-900), le point — seule étincelle de couleur — en `--accent`.
 * Toujours en minuscules. Les styles vivent dans `globals.css` (`.wordmark`).
 */
type WordmarkProps = {
  /** hauteur de police en px ; défaut 20 (taille header). Plancher charte : 14px. */
  size?: number;
  /** rend un lien vers l'accueil si fourni (chemin), sinon un simple `<span>`. */
  href?: string;
  /** nom accessible du lien (ex. « marge, retour à l'accueil »). */
  homeLabel?: string;
  className?: string;
};

/** Plancher de lisibilité imposé par la charte : jamais sous 14px. */
const MIN_SIZE = 14;

export function Wordmark({
  size = 20,
  href,
  homeLabel = "marge, retour à l'accueil",
  className,
}: WordmarkProps) {
  const fontSize = Math.max(size, MIN_SIZE);
  const cls = className ? `wordmark ${className}` : "wordmark";

  // Le mot porte un nom accessible explicite quand c'est un lien ; le point est
  // décoratif (`aria-hidden`) pour ne jamais être lu deux fois.
  const inner = (
    <>
      marge
      <span className="wordmark__dot" aria-hidden="true">
        .
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls} style={{ fontSize }} aria-label={homeLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <span className={cls} style={{ fontSize }}>
      {inner}
    </span>
  );
}
