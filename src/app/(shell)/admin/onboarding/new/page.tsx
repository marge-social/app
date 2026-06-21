import Link from "next/link";
import { CreatePackForm } from "@/components/admin/OnboardingPackForms";
import { requireAdmin } from "@/lib/admin";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.newPackMetaTitle };
}

export default async function AdminNewPackPage() {
  await requireAdmin();
  const { dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <section className="flex flex-col gap-4">
      <Link href="/admin/onboarding" className="text-sm hover:underline">
        {t.allPacks}
      </Link>
      <h2 className="text-lg font-medium">{t.newPack}</h2>
      <CreatePackForm />
    </section>
  );
}
