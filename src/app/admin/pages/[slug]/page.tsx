import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePageAction } from "@/app/actions/pages";
import { PageEditorForm } from "@/components/PageEditorForm";
import { requireAdmin } from "@/lib/admin";
import { getPage } from "@/lib/pages";
import { interpolate } from "@/lib/i18n/config";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.editPageMetaTitle };
}

export default async function AdminEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const page = await getPage(slug.toLowerCase());
  if (!page) notFound();
  const { dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          {interpolate(t.editPageTitle, { title: page.title })}
        </h2>
        <p className="text-sm text-black/55 dark:text-white/55">
          <Link href="/admin/pages" className="underline">
            {t.allPages}
          </Link>
          {page.isDefault && ` · ${t.defaultPageNotice}`}
        </p>
      </div>

      <PageEditorForm
        page={{
          slug: page.slug,
          title: page.title,
          contentMarkdown: page.contentMarkdown,
        }}
      />

      {!page.isDefault && (
        <form
          action={deletePageAction}
          className="border-t border-black/10 pt-4 dark:border-white/15"
        >
          <input type="hidden" name="slug" value={page.slug} />
          <button
            type="submit"
            className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
          >
            {t.deletePage}
          </button>
        </form>
      )}
    </section>
  );
}
