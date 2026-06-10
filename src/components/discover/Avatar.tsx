import { initials } from "@/lib/mock/discover";

/** Pastille d'avatar : photo de profil si disponible (`src`), sinon initiales.
 *  Primitive présentationnelle réutilisable, dimensionnable. */
export function Avatar({
  name,
  color,
  src,
  size = 28,
  className = "author-dot",
}: {
  name: string;
  color: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      // URL d'avatar arbitraire (API locale ou serveur distant), hors
      // périmètre next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={className}
        style={{ width: size, height: size, objectFit: "cover" }}
        loading="lazy"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={className}
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
