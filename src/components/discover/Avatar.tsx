import { initials } from "@/lib/mock/discover";

/** Pastille d'avatar à initiales (les avatars image réels viendront de S3).
 *  Primitive présentationnelle réutilisable, dimensionnable. */
export function Avatar({
  name,
  color,
  size = 28,
  className = "author-dot",
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
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
