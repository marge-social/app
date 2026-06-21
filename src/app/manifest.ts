import type { MetadataRoute } from "next";

/**
 * Manifest PWA. Couleurs alignées sur les tokens : fond et `theme_color` en
 * blanc (#ffffff = --bg) — le chrome reste **neutre** (cf. design system), le
 * lie-de-vin n'apparaît que comme point d'accent dans les icônes, jamais comme
 * teinte de chrome système. Icône favicon = marque réduite (point) ; icônes
 * d'application = mot-symbole « marge. » complet.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "marge.",
    short_name: "marge",
    description:
      "Média social de contenus longs, sourcés et fédérés, à contre-courant de l'économie attentionnelle.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      {
        src: "/icons/maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
