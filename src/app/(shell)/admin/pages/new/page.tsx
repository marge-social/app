import Link from "next/link";
import { PageEditorForm } from "@/components/PageEditorForm";
import { requireAdmin } from "@/lib/admin";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.newPageMetaTitle };
}

export default async function AdminNewPage() {
  await requireAdmin();
  const { dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t.newPage}</h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          <Link href="/admin/pages" className="underline">
            {t.allPages}
          </Link>
        </p>
      </div>
      <PageEditorForm isNew />
    </section>
  );
}
