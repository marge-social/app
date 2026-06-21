import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { plural } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";
import { listPacksWithItems } from "@/lib/onboarding-packs";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.onboardingMetaTitle };
}

export default async function AdminOnboardingPage() {
  await requireAdmin();
  const packs = await listPacksWithItems();
  const { locale, dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t.onboardingTitle}</h2>
          <p className="text-sm text-black/55 dark:text-white/55">{t.onboardingIntro}</p>
        </div>
        <Link
          href="/admin/onboarding/new"
          className="shrink-0 rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          {t.newPack}
        </Link>
      </div>

      {packs.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">{t.noPacks}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {packs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="flex flex-col gap-0.5">
                <Link href={`/admin/onboarding/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                {p.tag && (
                  <span className="text-xs text-black/55 dark:text-white/55">{p.tag}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-black/55 dark:text-white/55">
                {!p.enabled && (
                  <span className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                    {t.packDisabledBadge}
                  </span>
                )}
                <span>{plural(locale, p.items.length, t.packItemsCount)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
