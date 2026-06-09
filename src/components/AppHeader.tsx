import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { getServerI18n } from "@/lib/i18n/server";
import { AppHeaderNav } from "@/components/AppHeaderNav";

function initialsFromHandle(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}

/**
 * En-tête global de l'app (shell partagé issu du design « Découvrir »).
 * Server component : lit la session réelle + l'i18n. La nav éditoriale
 * (Découvrir/Suivis/Auteurs/Sujets) est en partie un stub pré-bêta ; les
 * contrôles de compte (compose, notifications, préférences, déconnexion) sont
 * fonctionnels. Le menu déroulant compte est un `<details>` (sans JS) ; la nav
 * smartphone est une île client (`AppHeaderNav`).
 */
export async function AppHeader() {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadNotifications(user.id) : 0;
  const { dict } = await getServerI18n();
  const nav = dict.nav;

  return (
    <header className="app-header">
      <Link href="/" className="brand">
        <span>Marge</span>
        <span className="dot">.</span>
      </Link>

      <nav className="nav" aria-label={nav.mainLabel}>
        <Link href="/" aria-current="page">
          Découvrir
        </Link>
        {/* TODO: vues dédiées (suivis / auteurs / sujets). */}
        <a href="#">Suivis</a>
        <a href="#">Auteurs</a>
        <a href="#">Sujets</a>
      </nav>

      <form className="search" action="/recherche" method="get" role="search">
        <span className="ic" aria-hidden>
          ⌕
        </span>
        <label htmlFor="header-search" className="sr-only">
          {nav.searchLabel}
        </label>
        <input
          id="header-search"
          type="search"
          name="q"
          placeholder="Rechercher un texte, un auteur, une source…"
        />
      </form>

      <div className="header-right">
        <div className="header-right-desktop">
          {user ? (
            <>
              <Link className="btn btn-ghost" href="/compose">
                {nav.write}
              </Link>
              <details className="acct">
                <summary aria-label={nav.profile}>
                  <span className="avatar">{initialsFromHandle(user.handle)}</span>
                </summary>
                <div className="acct-menu" role="menu">
                  <Link href={`/@${user.handle}`} role="menuitem">
                    {nav.profile}
                  </Link>
                  <Link href="/notifications" role="menuitem">
                    {nav.notifications}
                    {unread > 0 && (
                      <span className="acct-badge">{unread > 99 ? "99+" : unread}</span>
                    )}
                  </Link>
                  {user.role === "admin" && (
                    <Link href="/admin/accounts" role="menuitem">
                      {nav.admin}
                    </Link>
                  )}
                  <Link href="/preferences" role="menuitem">
                    {nav.preferences}
                  </Link>
                  <form action={logoutAction}>
                    <button type="submit" role="menuitem">
                      {nav.logout}
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" href="/">
                {nav.login}
              </Link>
              <Link className="btn btn-ink" href="/signup">
                {nav.signup}
              </Link>
            </>
          )}
        </div>

        <AppHeaderNav
          user={user ? { handle: user.handle, role: user.role } : null}
          unread={unread}
          labels={{
            search: nav.searchLabel,
            searchPlaceholder: "Rechercher un texte, un auteur, une source…",
            write: nav.write,
            notifications: nav.notifications,
            admin: nav.admin,
            profile: nav.profile,
            preferences: nav.preferences,
            logout: nav.logout,
            login: nav.login,
            signup: nav.signup,
            openMenu: nav.openMenu,
            closeMenu: nav.closeMenu,
          }}
        />
      </div>
    </header>
  );
}
