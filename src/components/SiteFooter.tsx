import Link from "next/link";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { getServerI18n } from "@/lib/i18n/server";

/** Pied de page minimal : mentions légales (RGPD / découvrabilité) + sélecteur de langue. */
export async function SiteFooter() {
  const { locale, dict } = await getServerI18n();
  return (
    <footer className="border-t border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 text-sm text-black/55 dark:text-white/55">
        <Wordmark size={15} />
        <div className="flex items-center gap-4">
          <Link href="/mentions-legales" className="hover:underline">
            {dict.footer.legal}
          </Link>
          <LocaleSwitcher current={locale} label={dict.common.language} />
        </div>
      </div>
    </footer>
  );
}
