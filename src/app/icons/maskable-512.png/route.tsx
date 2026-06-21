import { renderWordmarkImage } from "@/app/_brand/wordmark-image";

// Icône PWA maskable 512×512 : police plus petite pour rester dans la « zone de
// sécurité » (~80 %) que les masques Android peuvent rogner. Fond blanc plein.
export function GET() {
  return renderWordmarkImage({ width: 512, height: 512, fontSize: 88 });
}
