"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

type SessionUser = { handle: string; role: string };

interface NavLabels {
  search: string;
  searchPlaceholder: string;
  write: string;
  notifications: string;
  admin: string;
  profile: string;
  preferences: string;
  logout: string;
  login: string;
  signup: string;
  openMenu: string;
  closeMenu: string;
}

/**
 * Nav smartphone du header global. Bouton menu (visible < 880px via CSS) qui
 * déploie un panneau vertical. Reprend la logique éprouvée de l'ancien
 * `HeaderNav` (fermeture à la navigation + Échap, blocage du scroll de fond).
 */
export function AppHeaderNav({
  user,
  unread,
  labels,
}: {
  user: SessionUser | null;
  unread: number;
  labels: NavLabels;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Referme le menu à chaque navigation (ajusté pendant le rendu, pas via effet).
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setOpen(false);
  }

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
      <button
        type="button"
        className="header-menu-btn"
        aria-expanded={open}
        aria-controls="app-mobile-menu"
        aria-label={open ? labels.closeMenu : labels.openMenu}
        onClick={() => setOpen((v) => !v)}
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

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <div id="app-mobile-menu" className="mobile-menu">
            <div className="mobile-menu-inner">
              <form action="/recherche" method="get" role="search" className="mb-2">
                <label htmlFor="mobile-search" className="sr-only">
                  {labels.search}
                </label>
                <input
                  id="mobile-search"
                  type="search"
                  name="q"
                  placeholder={labels.searchPlaceholder}
                  className="w-full rounded-full border border-rule bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink-3"
                />
              </form>

              <Link href="/">Découvrir</Link>
              {user ? (
                <>
                  <Link href="/compose">{labels.write}</Link>
                  <Link href="/notifications">
                    {labels.notifications}
                    {unread > 0 && <span className="acct-badge">{unread > 99 ? "99+" : unread}</span>}
                  </Link>
                  {user.role === "admin" && <Link href="/admin/accounts">{labels.admin}</Link>}
                  <Link href={`/@${user.handle}`}>{labels.profile}</Link>
                  <Link href="/preferences">{labels.preferences}</Link>
                  <form action={logoutAction}>
                    <button type="submit">{labels.logout}</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/">{labels.login}</Link>
                  <Link href="/signup">{labels.signup}</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
