import { renderWordmarkImage } from "@/app/_brand/wordmark-image";

// Image de partage (Open Graph) : mot-symbole « marge. » sur fond blanc.
export const alt = "marge.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderWordmarkImage({ width: 1200, height: 630, fontSize: 200 });
}
