import "server-only";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Accès au stockage objet S3-compatible (OVH Object Storage, cahier médias §2).
 *
 * Toute la configuration est lue **paresseusement** au premier appel (jamais au
 * niveau module) : conforme au correctif « pas de secret lu au niveau module »,
 * sans quoi le build casse. Les octets transitent app → bucket et sont ensuite
 * servis depuis l'origine séparée `media.marge.social` (cf. `mediaUrl`).
 */

let client: S3Client | null = null;
let bucketName: string | null = null;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function getS3Client(): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: env("S3_ENDPOINT"),
    region: env("S3_REGION"),
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
    // OVH peut exiger le path-style selon la région/configuration du bucket.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  return client;
}

function bucket(): string {
  bucketName ??= env("S3_BUCKET");
  return bucketName;
}

/** Génère une clé d'objet opaque (UUID), jamais le nom de fichier fourni. */
export function mediaKey(prefix: string, ext: string): string {
  return `${prefix}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Téléverse un objet en **lecture publique**. Sur la région OVH GRA, les bucket
 * policies ne sont pas disponibles (`PutBucketPolicy` → `NotImplemented`) : on
 * pose donc l'ACL `public-read` **et** le `Content-Type` validé sur chaque
 * `PutObject` (sans ACL → 403 ; sans bon type → l'image se télécharge).
 */
export async function putObject(opts: {
  key: string;
  body: Buffer;
  contentType: string;
  /** Ex. "attachment" pour forcer le téléchargement des PDF (§3.4). */
  contentDisposition?: string;
}): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      ContentDisposition: opts.contentDisposition,
      ACL: "public-read",
    }),
  );
}

/** Supprime un objet (nettoyage best-effort, ex. remplacement d'avatar). */
export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}
