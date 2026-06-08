import type { SitePageView as SitePage } from "@/lib/pages";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { formatLongDate } from "@/lib/relative-time";

/** Rendu public d'une page de contenu (Markdown sanitisé + date de MAJ). */
export async function SitePageView({ page }: { page: SitePage }) {
  const { locale, dict } = await getServerI18n();
  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
      <div
        className="prose-marge"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
      {page.updatedAt && (
        <p className="text-sm text-black/55 dark:text-white/55">
          {interpolate(dict.common.lastUpdated, {
            date: formatLongDate(page.updatedAt, locale),
          })}
        </p>
      )}
    </article>
  );
}
