import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * Chrome global de l'application : lien d'évitement + en-tête + pied de page,
 * autour du contenu de page. Utilisé par le layout du groupe `(shell)` (toutes
 * les pages hors portail visiteur) et par la home connectée (qui vit à la racine
 * pour laisser le portail visiteur s'affranchir de ce chrome).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const { dict } = await getServerI18n();
  return (
    <>
      <a href="#main-content" className="skip-link">
        {dict.common.skipToContent}
      </a>
      <AppHeader />
      <main id="main-content" tabIndex={-1} className="w-full flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
