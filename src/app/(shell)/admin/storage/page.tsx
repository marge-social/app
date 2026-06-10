import { requireAdmin } from "@/lib/admin";
import { interpolate, plural } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import {
  collectStorageStats,
  computeGrowth,
  formatBytes,
  getSnapshots,
  recordSnapshotIfDue,
} from "@/lib/monitoring";
import { formatLongDate } from "@/lib/relative-time";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.storageMetaTitle };
}

/**
 * Monitoring de volumétrie (lecture seule) : taille de la base par table,
 * disque, médias S3, et tendance de croissance d'après les relevés quotidiens.
 */
export default async function AdminStoragePage() {
  await requireAdmin();
  const { locale, dict } = await getServerI18n();
  const t = dict.admin;

  const stats = await collectStorageStats();
  await recordSnapshotIfDue(stats);
  const snapshots = await getSnapshots();
  const growth = computeGrowth(snapshots);

  const fb = (bytes: number) => formatBytes(bytes, locale);
  const fbSigned = (bytes: number) =>
    formatBytes(bytes, locale, { signed: true });
  const windowDays = growth ? Math.round(growth.windowDays) : null;

  const cardClass =
    "flex flex-col gap-1 rounded-lg border border-black/10 p-4 dark:border-white/15";
  const hintClass = "text-xs text-black/55 dark:text-white/55";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-black/55 dark:text-white/55">
        {t.storageIntro}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardClass}>
          <h2 className="text-sm font-medium">{t.storageCardDb}</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {fb(stats.dbSizeBytes)}
          </p>
          <p className={hintClass}>{t.storageCardDbHint}</p>
        </div>

        <div className={cardClass}>
          <h2 className="text-sm font-medium">{t.storageCardDisk}</h2>
          {stats.diskTotalBytes !== null && stats.diskFreeBytes !== null ? (
            <>
              <p className="text-2xl font-semibold tabular-nums">
                {Math.round(
                  ((stats.diskTotalBytes - stats.diskFreeBytes) /
                    stats.diskTotalBytes) *
                    100,
                )}
                %
              </p>
              <p className={hintClass}>
                {interpolate(t.storageCardDiskFree, {
                  free: fb(stats.diskFreeBytes),
                  total: fb(stats.diskTotalBytes),
                })}
              </p>
            </>
          ) : (
            <p className="text-2xl font-semibold">{t.storageCardDiskUnknown}</p>
          )}
          <p className={hintClass}>{t.storageCardDiskHint}</p>
        </div>

        <div className={cardClass}>
          <h2 className="text-sm font-medium">{t.storageCardMedia}</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {fb(stats.mediaBytes)}
          </p>
          <p className={hintClass}>
            {plural(locale, stats.mediaCount, t.storageCardMediaCount)} —{" "}
            {t.storageCardMediaHint}
          </p>
        </div>

        <div className={cardClass}>
          <h2 className="text-sm font-medium">{t.storageCardGrowth}</h2>
          {growth ? (
            <>
              <p className="text-2xl font-semibold tabular-nums">
                {interpolate(t.storageGrowthPerDay, {
                  v: fbSigned(growth.dbBytesPerDay),
                })}
              </p>
              <p className={hintClass}>
                {interpolate(t.storageGrowthPerYear, {
                  v: fbSigned(growth.dbBytesPerDay * 365),
                })}
              </p>
              <p className={hintClass}>
                {interpolate(t.storageGrowthWindow, { n: windowDays ?? 0 })}
              </p>
            </>
          ) : (
            <p className={hintClass}>{t.storageGrowthInsufficient}</p>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.storageTablesTitle}</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/15">
                <th className="px-3 py-2 font-medium">{t.storageColTable}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t.storageColRows}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t.storageColSize}
                </th>
                <th className="px-3 py-2 font-medium">{t.storageColShare}</th>
                {growth && (
                  <th className="px-3 py-2 text-right font-medium">
                    {interpolate(t.storageColDelta, { n: windowDays ?? 0 })}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {stats.tables.map((table) => {
                const share = stats.dbSizeBytes
                  ? table.totalBytes / stats.dbSizeBytes
                  : 0;
                const delta = growth?.tableDeltas[table.name];
                return (
                  <tr
                    key={table.name}
                    className="border-b border-black/5 last:border-0 dark:border-white/10"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {table.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {table.approxRows === null
                        ? "—"
                        : new Intl.NumberFormat(locale).format(
                            table.approxRows,
                          )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {fb(table.totalBytes)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          aria-hidden
                          className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
                        >
                          <div
                            className="h-full rounded-full bg-foreground/60"
                            style={{
                              width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-black/55 dark:text-white/55">
                          {new Intl.NumberFormat(locale, {
                            style: "percent",
                            maximumFractionDigits: 1,
                          }).format(share)}
                        </span>
                      </div>
                    </td>
                    {growth && (
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {delta === undefined || delta === 0
                          ? "—"
                          : fbSigned(delta)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.storageHistoryTitle}</h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          {plural(
            locale,
            snapshots.length,
            t.storageSnapshotCount,
            snapshots.length > 0
              ? {
                  date: formatLongDate(
                    snapshots[snapshots.length - 1].capturedAt,
                    locale,
                  ),
                }
              : undefined,
          )}
        </p>
        {snapshots.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left dark:border-white/15">
                  <th className="px-3 py-2 font-medium">{t.storageColDate}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t.storageColDbSize}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t.storageColMedia}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t.storageColDiskFree}
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshots.slice(0, 30).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/10"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatLongDate(s.capturedAt, locale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fb(s.dbSizeBytes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fb(s.mediaBytes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.diskFreeBytes !== null ? fb(s.diskFreeBytes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
