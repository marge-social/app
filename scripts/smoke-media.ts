/**
 * Test fumée de la validation des médias (cahier médias §3.3, §8.1/§8.2/§8.5),
 * SANS réseau ni S3 (ne teste que `processUpload`). Lancer : npx tsx
 * scripts/smoke-media.ts
 *
 * Note : `media.ts` importe `server-only`, qu'au build Next aliase lui-même mais
 * que Node ne résout pas. Pour exécuter ce script hors Next, créer un stub :
 *   mkdir -p node_modules/server-only && echo 'module.exports={}' \
 *     > node_modules/server-only/index.js
 */
import sharp from "sharp";
import { processUpload } from "../src/lib/media";

function file(buf: Buffer, name: string, type = "application/octet-stream"): File {
  return new File([new Uint8Array(buf)], name, { type });
}

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}

async function main() {
  // PNG valide avec EXIF (orientation) → accepté, EXIF purgé, miniature générée.
  const pngWithExif = await sharp({
    create: { width: 64, height: 32, channels: 3, background: "#c33" },
  })
    .withExif({ IFD0: { Software: "smoke-test", Copyright: "secret-gps" } })
    .jpeg()
    .toBuffer();
  const r1 = await processUpload(file(pngWithExif, "photo.jpg", "image/jpeg"));
  check("jpg valide accepté", r1.ok && r1.kind === "image");
  if (r1.ok) {
    check("dimensions extraites", r1.width === 64 && r1.height === 32);
    check("miniature générée", !!r1.thumbBuffer);
    const meta = await sharp(r1.buffer).metadata();
    // sharp ne recopie pas les métadonnées → plus d'EXIF dans la sortie.
    check("EXIF purgé (re-encodage)", meta.exif === undefined);
  }

  // .zip (signature PK) → rejeté (hors liste blanche).
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  const r2 = await processUpload(file(zip, "archive.zip", "application/zip"));
  check(".zip rejeté", !r2.ok);

  // .js (texte) → file-type ne détecte rien d'autorisé → rejeté.
  const js = Buffer.from('alert("x");\n', "utf8");
  const r3 = await processUpload(file(js, "app.png", "image/png"));
  check(".js renommé .png rejeté", !r3.ok);

  // PNG réel mais annoncé .pdf → incohérence extension/contenu → rejeté (§3.3.2).
  const realPng = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#000" },
  })
    .png()
    .toBuffer();
  const r4 = await processUpload(file(realPng, "fake.pdf", "application/pdf"));
  check("contenu image annoncé .pdf rejeté", !r4.ok);

  // > 5 Mo → rejeté côté serveur (avant même la détection de type).
  const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
  const r5 = await processUpload(file(big, "huge.png", "image/png"));
  check("fichier > 5 Mo rejeté", !r5.ok);

  // PDF valide → accepté (kind pdf, pas de miniature).
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
    "latin1",
  );
  const r6 = await processUpload(file(pdf, "doc.pdf", "application/pdf"));
  check("pdf valide accepté", r6.ok && r6.kind === "pdf" && !r6.thumbBuffer);

  console.log(failures === 0 ? "\nTOUS OK" : `\n${failures} ÉCHEC(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
