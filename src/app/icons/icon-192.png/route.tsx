import { renderWordmarkImage } from "@/app/_brand/wordmark-image";

// Icône PWA 192×192 (référencée par le manifest). URL stable → pas de hash.
export function GET() {
  return renderWordmarkImage({ width: 192, height: 192, fontSize: 46 });
}
