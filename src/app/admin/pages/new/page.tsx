import Link from "next/link";
import { PageEditorForm } from "@/components/PageEditorForm";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Nouvelle page — Administration" };

export default async function AdminNewPage() {
  await requireAdmin();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Nouvelle page</h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          <Link href="/admin/pages" className="underline">
            ← Toutes les pages
          </Link>
        </p>
      </div>
      <PageEditorForm isNew />
    </section>
  );
}
