import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Administration — Marge" };

/** Protège toutes les routes `/admin/*` côté serveur (§3.2). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-black/55 dark:text-white/55">
          Supervision de l’instance (comptes et billets en lecture seule) et
          édition des pages de contenu. Aucune action de modération ici.
        </p>
        <nav
          aria-label="Navigation administration"
          className="flex gap-4 text-sm"
        >
          <Link href="/admin/accounts" className="hover:underline">
            Comptes
          </Link>
          <Link href="/admin/posts" className="hover:underline">
            Billets
          </Link>
          <Link href="/admin/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
        </nav>
      </div>
      {children}
    </section>
  );
}
