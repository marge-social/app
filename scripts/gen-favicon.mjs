// Régénère `src/app/favicon.ico` à partir de la marque réduite (le point accent
// sur fond blanc) — cohérent avec `src/app/icon.svg`. Le point étant une forme
// pure (cercle), aucune police n'est requise : rendu déterministe via sharp.
//
//   node scripts/gen-favicon.mjs
//
// ICO multi-tailles (16/32/48) encapsulant des PNG. Dépendance : sharp (déjà
// présent en prod pour le traitement média).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Mêmes valeurs que src/app/icon.svg : fond blanc, point lie-de-vin (--accent).
const svg = (s) =>
  Buffer.from(
    `<svg width="${s}" height="${s}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="32" height="32" rx="7" fill="#ffffff"/>` +
      `<circle cx="16" cy="16" r="6.5" fill="#7c3a4b"/>` +
      `</svg>`,
  );

const sizes = [16, 32, 48];

const pngs = await Promise.all(
  sizes.map((s) => sharp(svg(s)).resize(s, s).png().toBuffer()),
);

// Assemblage du conteneur ICO (en-tête + table d'entrées + PNG concaténés).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // réservé
header.writeUInt16LE(1, 2); // type = icône
header.writeUInt16LE(sizes.length, 4); // nombre d'images

const entries = [];
let offset = 6 + 16 * sizes.length;
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  const png = pngs[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0); // largeur
  e.writeUInt8(s >= 256 ? 0 : s, 1); // hauteur
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // réservé
  e.writeUInt16LE(1, 4); // plans
  e.writeUInt16LE(32, 6); // bits/pixel
  e.writeUInt32LE(png.length, 8); // taille des données
  e.writeUInt32LE(offset, 12); // décalage
  offset += png.length;
  entries.push(e);
}

const ico = Buffer.concat([header, ...entries, ...pngs]);
const out = join(root, "src/app/favicon.ico");
writeFileSync(out, ico);
console.log(`favicon.ico régénéré (${sizes.join("/")}) → ${out} (${ico.length} o)`);
