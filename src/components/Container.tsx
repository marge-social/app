import type { ReactNode } from "react";

/**
 * Conteneur de page centré — reproduit la mise en page que l'ancien `<main>`
 * fournissait (`mx-auto max-w-3xl px-4 py-8`) avant le passage au shell global
 * « Découvrir » (où le `<main>` racine est désormais pleine largeur).
 *
 * Appliqué à toutes les pages hors home (login, préférences, profil, compose,
 * notifications, recherche, feeds/[id], admin/*, pages de contenu…). La home
 * (`/`) fournit sa propre grille 3 colonnes et n'utilise pas ce conteneur.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-3xl px-4 py-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
