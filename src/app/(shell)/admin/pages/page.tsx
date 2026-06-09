import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listPages } from "@/lib/pages";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatLongDate } from "@/lib/relative-time";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.pagesMetaTitle };
}

export default async function AdminPagesPage() {
  await requireAdmin();
  const pages = await listPages();
  const { locale, dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t.pagesTitle}</h2>
          <p className="text-sm text-black/55 dark:text-white/55">
            {t.pagesIntro} <span className="font-mono">/slug</span>.
          </p>
        </div>
        <Link
          href="/admin/pages/new"
          className="shrink-0 rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          {t.newPage}
        </Link>
      </div>

      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {pages.map((p) => (
          <li
            key={p.slug}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/admin/pages/${p.slug}`}
                className="font-medium hover:underline"
              >
                {p.title}
              </Link>
              <span className="font-mono text-xs text-black/55 dark:text-white/55">
                /{p.slug}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-black/55 dark:text-white/55">
              {p.isDefault ? (
                <span className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                  {t.defaultContent}
                </span>
              ) : (
                p.updatedAt && (
                  <span>
                    {interpolate(t.updatedShort, {
                      date: formatLongDate(p.updatedAt, locale),
                    })}
                  </span>
                )
              )}
              <Link href={`/${p.slug}`} className="underline">
                {t.see}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
