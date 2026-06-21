import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Fabrique d'assets bitmap de la marque (apple-icon, icônes PWA, Open Graph,
 * Twitter) à partir du **mot-symbole** « marge. », rendu par `next/og` (satori).
 *
 * Les couleurs sont nécessairement « cuites » dans le pixel : elles reflètent
 * les tokens du thème — encre `--ink` (#0f0f0f) pour le mot, accent `--accent`
 * (#7c3a4b, lie-de-vin) pour le point, fond `--bg` (#ffffff). Aucune autre
 * couleur. La police Inter Tight 600 est embarquée (`_brand/*.ttf`) → rendu
 * fidèle et sans dépendance réseau au runtime.
 */
const INK = "#0f0f0f";
const ACCENT = "#7c3a4b";
const BG = "#ffffff";

let fontPromise: Promise<Buffer> | null = null;
function loadBrandFont(): Promise<Buffer> {
  fontPromise ??= readFile(
    join(process.cwd(), "src/app/_brand/InterTight-SemiBold.ttf"),
  );
  return fontPromise;
}

type WordmarkImageOptions = {
  width: number;
  height: number;
  /** taille de police en px du mot-symbole. */
  fontSize: number;
};

/** Rend le mot-symbole « marge. » centré sur fond blanc en `ImageResponse`. */
export async function renderWordmarkImage({
  width,
  height,
  fontSize,
}: WordmarkImageOptions): Promise<ImageResponse> {
  const font = await loadBrandFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          fontFamily: "Inter Tight",
          fontWeight: 600,
          fontSize,
          letterSpacing: "-0.03em",
          color: INK,
        }}
      >
        <span style={{ display: "flex" }}>
          marge<span style={{ color: ACCENT }}>.</span>
        </span>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        {
          name: "Inter Tight",
          data: font as unknown as ArrayBuffer,
          weight: 600,
          style: "normal",
        },
      ],
    },
  );
}
