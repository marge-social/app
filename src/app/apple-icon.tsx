import { renderWordmarkImage } from "@/app/_brand/wordmark-image";

// Icône Apple Touch (écran d'accueil iOS) : mot-symbole « marge. » centré.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderWordmarkImage({ width: 180, height: 180, fontSize: 42 });
}
