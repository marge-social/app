/** Jeu d'icônes inline (1.4 stroke) du design « Découvrir ». Présentationnel,
 *  sans état — `currentColor` + dimensionné par le CSS parent. */
import type { ReactElement } from "react";

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  "aria-hidden": true,
} as const;

export const Icons: Record<string, ReactElement> = {
  eye: (
    <svg {...base}>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  ),
  heart: (
    <svg {...base}>
      <path d="M8 13.5s-5.2-3-5.2-7c0-1.7 1.3-3 3-3 1.1 0 1.9.6 2.2 1.4.3-.8 1.1-1.4 2.2-1.4 1.7 0 3 1.3 3 3 0 4-5.2 7-5.2 7z" />
    </svg>
  ),
  reply: (
    <svg {...base}>
      <path d="M2 11V5h12v6H6.5L3 14v-3H2z" />
    </svg>
  ),
  note: (
    <svg {...base}>
      <path d="M3 3h10v10H3zM6 6h6M6 9h4M6 12h5" />
    </svg>
  ),
  book: (
    <svg {...base}>
      <path d="M3 3h6a3 3 0 0 1 3 3v8H6a3 3 0 0 1-3-3V3z" />
      <path d="M3 11a3 3 0 0 1 3-3h6" />
    </svg>
  ),
  bookmark: (
    <svg {...base}>
      <path d="M4 2h8v12l-4-3-4 3z" />
    </svg>
  ),
  share: (
    <svg {...base}>
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M5.5 7l5-2.4M5.5 9l5 2.4" />
    </svg>
  ),
  arrowRight: (
    <svg {...base} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  ),
  image: (
    <svg {...base} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6.5" r="1" />
      <path d="m3 11 3-2.5 2.5 2 2-1.5L13 11" />
    </svg>
  ),
  upload: (
    <svg {...base} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10.5V2.5" />
      <path d="M4.8 5.7 8 2.5l3.2 3.2" />
      <path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" />
    </svg>
  ),
};
