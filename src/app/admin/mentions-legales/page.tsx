import Link from "next/link";
import { LegalEditorForm } from "@/components/LegalEditorForm";
import { requireAdmin } from "@/lib/admin";
import { getLegalPage } from "@/lib/legal";

export const metadata = { title: "Mentions légales — Administration" };

export default async function AdminLegalPage() {
  await requireAdmin();
  const page = await getLegalPage();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Mentions légales</h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          Page publique éditable en Markdown, visible sur{" "}
          <Link href="/mentions-legales" className="underline">
            /mentions-legales
          </Link>
          .
          {page.isDefault &&
            " Contenu par défaut affiché : il sera figé tel quel au premier enregistrement."}
        </p>
      </div>
      <LegalEditorForm contentMarkdown={page.contentMarkdown} />
    </section>
  );
}
