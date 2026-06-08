import Link from "next/link";
import { Container } from "@/components/Container";
import { requireAdmin } from "@/lib/admin";
import { getServerI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.admin.metaTitle };
}

/** Protège toutes les routes `/admin/*` côté serveur (§3.2). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const { dict } = await getServerI18n();
  const t = dict.admin;

  return (
    <Container>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-black/55 dark:text-white/55">{t.intro}</p>
          <nav aria-label={t.navLabel} className="flex gap-4 text-sm">
            <Link href="/admin/accounts" className="hover:underline">
              {t.accounts}
            </Link>
            <Link href="/admin/posts" className="hover:underline">
              {t.posts}
            </Link>
            <Link href="/admin/pages" className="hover:underline">
              {t.pages}
            </Link>
          </nav>
        </div>
        {children}
      </section>
    </Container>
  );
}
