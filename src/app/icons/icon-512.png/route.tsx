import { renderWordmarkImage } from "@/app/_brand/wordmark-image";

// Icône PWA 512×512 (référencée par le manifest). URL stable → pas de hash.
export function GET() {
  return renderWordmarkImage({ width: 512, height: 512, fontSize: 122 });
}
