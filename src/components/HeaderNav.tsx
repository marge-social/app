"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { useT } from "@/components/I18nProvider";

type SessionUser = { handle: string; role: string };

function NotificationBadge({
  unread,
  label,
}: {
  unread: number;
  label: string;
}) {
  if (unread <= 0) return null;
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background"
      aria-label={label}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

/**
 * Navigation responsive. Sur grand écran (≥ sm) : barre horizontale comme avant.
 * Sur smartphone : un bouton « menu » déploie un panneau vertical. Aucun dark
 * pattern (le seul compteur reste le badge sobre de notifications non lues).
 *
 * Composant client : il porte l'état d'ouverture du menu mobile. Les données
 * (utilisateur, non-lues) lui sont passées par le `SiteHeader` serveur ; les
 * libellés viennent du dictionnaire i18n via `useT()`.
 */
export function HeaderNav({
  user,
  unread,
}: {
  user: SessionUser | null;
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, plural } = useT();
  const nav = t.nav;
  const badgeLabel = plural(unread, nav.unread);

  // Referme le menu à chaque navigation. On ajuste l'état pendant le rendu
  // (pattern React recommandé) plutôt que dans un effet : pas de re-rendu en
  // cascade. cf. https://react.dev/learn/you-might-not-need-an-effect
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setOpen(false);
  }

  // Referme avec Échap, et bloque le scroll de fond quand le menu est ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Barre horizontale — masquée sur smartphone. */}
      <div className="hidden items-center gap-4 text-sm sm:flex">
        {user ? (
          <>
            <form action="/recherche" method="get" role="search">
              <label htmlFor="nav-search" className="sr-only">
                {nav.searchLabel}
              </label>
              <input
                id="nav-search"
                type="search"
                name="q"
                placeholder={nav.searchPlaceholder}
                className="w-40 rounded border border-black/15 bg-transparent px-2 py-1 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
              />
            </form>
            <Link href="/compose" className="hover:underline">
              {nav.write}
            </Link>
            <Link
              href="/notifications"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {nav.notifications}
              <NotificationBadge unread={unread} label={badgeLabel} />
            </Link>
            {user.role === "admin" && (
              <Link href="/admin/accounts" className="hover:underline">
                {nav.admin}
              </Link>
            )}
            <Link href={`/@${user.handle}`} className="hover:underline">
              {nav.profile}
            </Link>
            <Link href="/preferences" className="hover:underline">
              {nav.preferences}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded border border-black/15 px-2 py-1 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {nav.logout}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:underline">
              {nav.login}
            </Link>
            <Link
              href="/signup"
              className="rounded bg-foreground px-3 py-1 text-background hover:opacity-90"
            >
              {nav.signup}
            </Link>
          </>
        )}
      </div>

      {/* Smartphone : bouton menu (+ badge non-lues visible replié). */}
      <div className="flex items-center gap-3 sm:hidden">
        {user && unread > 0 && (
          <Link
            href="/notifications"
            aria-label={plural(unread, nav.unreadNotifications)}
          >
            <NotificationBadge unread={unread} label={badgeLabel} />
          </Link>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? nav.closeMenu : nav.openMenu}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded border border-black/15 p-2 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden
          >
            {open ? (
              <>
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Panneau déroulant smartphone. */}
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20 sm:hidden"
          />
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full z-50 border-b border-black/10 bg-background shadow-lg sm:hidden dark:border-white/15"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-3 text-base">
              {user ? (
                <>
                  <form action="/recherche" method="get" role="search" className="mb-2">
                    <label htmlFor="mobile-search" className="sr-only">
                      {nav.searchLabel}
                    </label>
                    <input
                      id="mobile-search"
                      type="search"
                      name="q"
                      placeholder={nav.searchPlaceholder}
                      className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
                    />
                  </form>
                  <Link href="/compose" className="rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                    {nav.write}
                  </Link>
                  <Link
                    href="/notifications"
                    className="flex items-center gap-2 rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {nav.notifications}
                    <NotificationBadge unread={unread} label={badgeLabel} />
                  </Link>
                  {user.role === "admin" && (
                    <Link href="/admin/accounts" className="rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                      {nav.admin}
                    </Link>
                  )}
                  <Link href={`/@${user.handle}`} className="rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                    {nav.profile}
                  </Link>
                  <Link href="/preferences" className="rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                    {nav.preferences}
                  </Link>
                  <form action={logoutAction} className="mt-1">
                    <button
                      type="submit"
                      className="w-full rounded border border-black/15 px-2 py-2 text-left hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      {nav.logout}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10">
                    {nav.login}
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded bg-foreground px-3 py-2 text-center text-background hover:opacity-90"
                  >
                    {nav.signup}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
