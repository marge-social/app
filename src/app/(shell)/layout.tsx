import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

/**
 * Layout du groupe `(shell)` : applique le chrome global (en-tête + pied) à
 * toutes les pages de l'application *sauf* le portail visiteur (home
 * déconnectée), qui vit à la racine et fournit son propre cadre plein écran.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
