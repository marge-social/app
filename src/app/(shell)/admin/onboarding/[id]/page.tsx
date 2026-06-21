import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deletePackAction,
  removePackItemAction,
} from "@/app/actions/onboarding-packs";
import { AddItemForm, PackSettingsForm } from "@/components/admin/OnboardingPackForms";
import { requireAdmin } from "@/lib/admin";
import { getServerI18n } from "@/lib/i18n/server";
import { type OnboardingItemType, getPack } from "@/lib/onboarding-packs";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.editPackMetaTitle };
}

export default async function AdminEditPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const pack = await getPack(id);
  if (!pack) notFound();

  const { dict } = await getServerI18n();
  const t = dict.admin;
  const typeLabel: Record<OnboardingItemType, string> = {
    marge: t.packTypeMarge,
    fediverse: t.packTypeFediverse,
    rss: t.packTypeRss,
    youtube: t.packTypeYoutube,
  };

  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/onboarding" className="text-sm hover:underline">
        {t.allPacks}
      </Link>

      <PackSettingsForm pack={pack} />

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t.packItemsTitle}</h3>
        {pack.items.length === 0 ? (
          <p className="text-sm text-black/55 dark:text-white/55">{t.noPackItems}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {pack.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="font-mono text-xs text-black/55 dark:text-white/55">
                    {item.ref}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-black/55 dark:text-white/55">
                  <span className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                    {typeLabel[item.type]}
                  </span>
                  <form action={removePackItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="packId" value={pack.id} />
                    <button type="submit" className="underline hover:text-red-700 dark:hover:text-red-300">
                      {t.removePackItem}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddItemForm packId={pack.id} />
      </div>

      <form action={deletePackAction} className="border-t border-black/10 pt-4 dark:border-white/10">
        <input type="hidden" name="id" value={pack.id} />
        <button
          type="submit"
          className="text-sm text-red-700 underline hover:opacity-80 dark:text-red-300"
        >
          {t.deletePack}
        </button>
      </form>
    </section>
  );
}
