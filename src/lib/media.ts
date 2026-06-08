import "server-only";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { mediaUrl } from "@/lib/config";
import { mediaKey, putObject } from "@/lib/storage";

export type MediaKind = "image" | "video" | "audio" | "pdf";

/** Limite stricte par fichier (cahier médias §3.3) — vérifiée côté serveur. */
export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Liste **blanche** (§3.2) : seuls ces types réels (magic bytes) sont acceptés.
 * Tout le reste (svg, zip, php, js, html, exe…) est rejeté par défaut. La clé
 * est le MIME détecté par `file-type` ; `ext` est l'extension canonique posée.
 */
const ALLOWED: Record<string, { kind: MediaKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/gif": { kind: "image", ext: "gif" },
  "image/webp": { kind: "image", ext: "webp" },
  "application/pdf": { kind: "pdf", ext: "pdf" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
};

/**
 * Renvoie la nature d'un média pour un MIME donné s'il est dans la liste blanche
 * (sinon null). Sert à filtrer les pièces jointes **distantes** reçues (§4.2)
 * sans re-télécharger les octets.
 */
export function mediaKindForMime(mime: string | null | undefined): MediaKind | null {
  if (!mime) return null;
  return ALLOWED[mime]?.kind ?? null;
}

/** Format de sortie `sharp` par extension d'image. */
const SHARP_FORMAT: Record<string, keyof sharp.FormatEnum> = {
  jpg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export type ProcessResult =
  | { ok: false; error: string }
  | {
      ok: true;
      kind: MediaKind;
      mimeType: string;
      ext: string;
      buffer: Buffer;
      thumbBuffer?: Buffer;
      width?: number;
      height?: number;
    };

/** Extension annoncée par le nom de fichier, normalisée (jpeg→jpg). */
function declaredExt(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

/**
 * Valide et prépare un upload **côté serveur**, sans réseau (testable seul) :
 * 1. taille ≤ 5 Mo ; 2. type **réel** par magic bytes (jamais l'extension ni le
 * `Content-Type` client, falsifiables) + cohérence avec l'extension annoncée
 * (§3.3.2) ; 3. images **re-encodées** (neutralise toute charge intégrée),
 * **EXIF purgé** (sharp ne recopie pas les métadonnées), orientation appliquée,
 * dimensions extraites + **miniature** générée (§3.3.3).
 */
export async function processUpload(file: File): Promise<ProcessResult> {
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fichier trop lourd (max 5 Mo)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = await fileTypeFromBuffer(buffer);
  const allowed = detected ? ALLOWED[detected.mime] : undefined;
  if (!detected || !allowed) {
    return {
      ok: false,
      error: "Format non autorisé (images, PDF, MP4/WebM, MP3 uniquement).",
    };
  }

  // L'extension annoncée doit correspondre au type réel (anti-renommage).
  const claimed = declaredExt(file.name);
  if (claimed && claimed !== allowed.ext) {
    return {
      ok: false,
      error: "L’extension du fichier ne correspond pas à son contenu réel.",
    };
  }

  if (allowed.kind !== "image") {
    // PDF / vidéo / audio : validés par magic bytes, stockés tels quels.
    return {
      ok: true,
      kind: allowed.kind,
      mimeType: detected.mime,
      ext: allowed.ext,
      buffer,
    };
  }

  // Image : re-encodage + purge EXIF + miniature.
  const format = SHARP_FORMAT[allowed.ext];
  try {
    const base = sharp(buffer, { animated: true }).rotate();
    const { data, info } = await base
      .clone()
      .toFormat(format)
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: 800, withoutEnlargement: true })
      .toFormat(format)
      .toBuffer();
    return {
      ok: true,
      kind: "image",
      mimeType: detected.mime,
      ext: allowed.ext,
      buffer: data,
      thumbBuffer: thumb,
      width: info.width,
      height: info.height,
    };
  } catch {
    return { ok: false, error: "Image illisible ou corrompue." };
  }
}

type MediaRow = typeof media.$inferSelect;

/**
 * Téléverse le média validé sur le bucket (objet principal + miniature) puis
 * persiste la ligne `media`. À appeler **après** `processUpload` (validation
 * d'abord, S3 ensuite) et après création du contenu parent éventuel.
 */
export async function persistMedia(opts: {
  ownerUserId: string;
  processed: Extract<ProcessResult, { ok: true }>;
  altText?: string | null;
  postId?: string | null;
  articleId?: string | null;
}): Promise<MediaRow> {
  const { processed } = opts;
  const key = mediaKey("media", processed.ext);
  await putObject({
    key,
    body: processed.buffer,
    contentType: processed.mimeType,
    // PDF en pièce jointe (téléchargement) plutôt qu'inline (§3.4).
    contentDisposition: processed.kind === "pdf" ? "attachment" : undefined,
  });

  let thumbnailKey: string | null = null;
  if (processed.thumbBuffer) {
    thumbnailKey = mediaKey("media/thumb", processed.ext);
    await putObject({
      key: thumbnailKey,
      body: processed.thumbBuffer,
      contentType: processed.mimeType,
    });
  }

  const [row] = await db
    .insert(media)
    .values({
      ownerUserId: opts.ownerUserId,
      kind: processed.kind,
      mimeType: processed.mimeType,
      storageKey: key,
      url: mediaUrl(key),
      thumbnailKey,
      thumbnailUrl: thumbnailKey ? mediaUrl(thumbnailKey) : null,
      sizeBytes: processed.buffer.byteLength,
      width: processed.width ?? null,
      height: processed.height ?? null,
      altText: opts.altText ?? null,
      postId: opts.postId ?? null,
      articleId: opts.articleId ?? null,
    })
    .returning();
  return row;
}

/** Projection d'affichage / fédération d'un média (locale ou distante). */
export interface MediaView {
  kind: MediaKind;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  /**
   * Playlist HLS d'une vidéo distante (PeerTube) quand `url` n'est pas un mp4
   * directement lisible. Le lecteur la charge via hls.js à la demande.
   */
  hlsUrl?: string | null;
}

function toView(row: MediaRow): MediaView {
  return {
    kind: row.kind,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    mimeType: row.mimeType,
    alt: row.altText,
    width: row.width,
    height: row.height,
  };
}

/** Charge les médias rattachés à un lot de posts (pas de N+1). */
export async function loadMediaForPosts(
  postIds: string[],
): Promise<Map<string, MediaView[]>> {
  const map = new Map<string, MediaView[]>();
  if (postIds.length === 0) return map;
  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.postId, postIds));
  for (const row of rows) {
    if (!row.postId) continue;
    const arr = map.get(row.postId);
    if (arr) arr.push(toView(row));
    else map.set(row.postId, [toView(row)]);
  }
  return map;
}

/** Charge les médias rattachés à un lot d'articles (pas de N+1). */
export async function loadMediaForArticles(
  articleIds: string[],
): Promise<Map<string, MediaView[]>> {
  const map = new Map<string, MediaView[]>();
  if (articleIds.length === 0) return map;
  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.articleId, articleIds));
  for (const row of rows) {
    if (!row.articleId) continue;
    const arr = map.get(row.articleId);
    if (arr) arr.push(toView(row));
    else map.set(row.articleId, [toView(row)]);
  }
  return map;
}
