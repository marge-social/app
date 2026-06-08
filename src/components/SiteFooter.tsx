import Link from "next/link";

/** Pied de page minimal : lien vers les mentions légales (RGPD / découvrabilité). */
export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 text-sm text-black/55 dark:text-white/55">
        <span>Marge</span>
        <Link href="/mentions-legales" className="hover:underline">
          Mentions légales
        </Link>
      </div>
    </footer>
  );
}
