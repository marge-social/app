import { statfs } from "node:fs/promises";
import { desc } from "drizzle-orm";
import { db, sql } from "@/db";
import { storageSnapshots } from "@/db/schema";

/**
 * Monitoring de volumétrie (admin). Collecte l'état courant (taille de la base
 * par table, médias S3, disque) et entretient un historique de relevés
 * (`storage_snapshots`) pour mesurer la croissance — la base grossit sans purge
 * (`remote_objects`, `feed_items`), l'objectif est de ne pas se faire surprendre.
 */

export interface TableStat {
  name: string;
  /** pg_total_relation_size : table + index + TOAST. */
  totalBytes: number;
  /**
   * Estimation du planificateur (pg_class.reltuples) — pas un COUNT exact.
   * null tant que la table n'a jamais été analysée (reltuples = -1).
   */
  approxRows: number | null;
}

export interface StorageStats {
  dbSizeBytes: number;
  /** Toutes les tables du schéma public (y compris KV/queue Fedify), triées par taille. */
  tables: TableStat[];
  /** Somme de media.size_bytes : volume S3 journalisé (hors miniatures). */
  mediaBytes: number;
  mediaCount: number;
  diskTotalBytes: number | null;
  diskFreeBytes: number | null;
}

export type StorageSnapshot = typeof storageSnapshots.$inferSelect;

/** Croissance mesurée entre deux relevés (fenêtre réellement disponible). */
export interface StorageGrowth {
  /** Largeur réelle de la fenêtre, en jours (≥ 1). */
  windowDays: number;
  dbBytesPerDay: number;
  mediaBytesPerDay: number;
  /** Delta par table sur la fenêtre (tables présentes dans l'un des relevés). */
  tableDeltas: Record<string, number>;
  /** Relevé de référence (le plus ancien de la fenêtre). */
  since: Date;
}

async function readDisk(): Promise<{ total: number; free: number } | null> {
  try {
    const s = await statfs(process.cwd());
    // bavail = blocs disponibles pour un processus non-root (vision réaliste).
    return { total: s.bsize * s.blocks, free: s.bsize * s.bavail };
  } catch {
    return null;
  }
}

export async function collectStorageStats(): Promise<StorageStats> {
  const [dbSize, tables, mediaAgg, disk] = await Promise.all([
    sql<{ bytes: string }[]>`
      select pg_database_size(current_database())::bigint as bytes
    `,
    sql<{ name: string; bytes: string; rows: string }[]>`
      select c.relname as name,
             pg_total_relation_size(c.oid)::bigint as bytes,
             c.reltuples::bigint as rows
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc
    `,
    sql<{ bytes: string; n: string }[]>`
      select coalesce(sum(size_bytes), 0)::bigint as bytes, count(*) as n
      from media
    `,
    readDisk(),
  ]);

  return {
    dbSizeBytes: Number(dbSize[0].bytes),
    tables: tables.map((t) => ({
      name: t.name,
      totalBytes: Number(t.bytes),
      approxRows: Number(t.rows) < 0 ? null : Number(t.rows),
    })),
    mediaBytes: Number(mediaAgg[0].bytes),
    mediaCount: Number(mediaAgg[0].n),
    diskTotalBytes: disk?.total ?? null,
    diskFreeBytes: disk?.free ?? null,
  };
}

/**
 * Un relevé par jour suffit pour une tendance : on n'enregistre que si le
 * dernier date de plus de ~20 h (deux visites le même jour n'en créent qu'un).
 */
const SNAPSHOT_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

export async function recordSnapshotIfDue(stats: StorageStats): Promise<void> {
  const latest = await db.query.storageSnapshots.findFirst({
    columns: { capturedAt: true },
    orderBy: [desc(storageSnapshots.capturedAt)],
  });
  if (
    latest &&
    Date.now() - latest.capturedAt.getTime() < SNAPSHOT_MIN_INTERVAL_MS
  ) {
    return;
  }
  await db.insert(storageSnapshots).values({
    dbSizeBytes: stats.dbSizeBytes,
    tableSizes: Object.fromEntries(
      stats.tables.map((t) => [t.name, t.totalBytes]),
    ),
    mediaBytes: stats.mediaBytes,
    diskTotalBytes: stats.diskTotalBytes,
    diskFreeBytes: stats.diskFreeBytes,
  });
}

/** Relevés du plus récent au plus ancien (~4 mois d'historique quotidien). */
export async function getSnapshots(limit = 120): Promise<StorageSnapshot[]> {
  return db.query.storageSnapshots.findMany({
    orderBy: [desc(storageSnapshots.capturedAt)],
    limit,
  });
}

/**
 * Croissance sur une fenêtre d'au plus `maxDays` : compare le relevé le plus
 * récent au plus ancien relevé de la fenêtre. null tant qu'on n'a pas deux
 * relevés espacés d'au moins un jour (historique insuffisant).
 */
export function computeGrowth(
  snapshots: StorageSnapshot[],
  maxDays = 30,
): StorageGrowth | null {
  if (snapshots.length < 2) return null;
  const newest = snapshots[0];
  const cutoff = newest.capturedAt.getTime() - maxDays * 24 * 60 * 60 * 1000;
  // Liste triée du plus récent au plus ancien → le dernier élément ≥ cutoff
  // est le plus ancien relevé de la fenêtre.
  const inWindow = snapshots.filter(
    (s) => s.capturedAt.getTime() >= cutoff,
  );
  const reference = inWindow[inWindow.length - 1];
  const days =
    (newest.capturedAt.getTime() - reference.capturedAt.getTime()) /
    (24 * 60 * 60 * 1000);
  if (days < 1) return null;

  const tableDeltas: Record<string, number> = {};
  const names = new Set([
    ...Object.keys(newest.tableSizes),
    ...Object.keys(reference.tableSizes),
  ]);
  for (const name of names) {
    tableDeltas[name] =
      (newest.tableSizes[name] ?? 0) - (reference.tableSizes[name] ?? 0);
  }

  return {
    windowDays: days,
    dbBytesPerDay: (newest.dbSizeBytes - reference.dbSizeBytes) / days,
    mediaBytesPerDay: (newest.mediaBytes - reference.mediaBytes) / days,
    tableDeltas,
    since: reference.capturedAt,
  };
}

/**
 * Formate un volume en unité lisible, localisé via Intl (fr : « 1,2 Go »,
 * en : "1.2 GB"). `signed` ajoute le signe explicite (deltas de croissance).
 */
export function formatBytes(
  bytes: number,
  locale: string,
  opts: { signed?: boolean } = {},
): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"];
  let value = bytes;
  let unit = 0;
  while (Math.abs(value) >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[unit],
    maximumFractionDigits: unit === 0 ? 0 : 1,
    ...(opts.signed ? { signDisplay: "exceptZero" as const } : {}),
  }).format(value);
}
