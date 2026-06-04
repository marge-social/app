import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { logoutAction } from "@/app/actions/auth";

/** En-tête global. Navigation minimale, sans dark pattern (le seul compteur est
 *  le badge sobre de notifications non lues). */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadNotifications(user.id) : 0;

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Marge
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <form
                action="/recherche"
                method="get"
                role="search"
                className="hidden sm:block"
              >
                <label htmlFor="nav-search" className="sr-only">
                  Rechercher
                </label>
                <input
                  id="nav-search"
                  type="search"
                  name="q"
                  placeholder="Rechercher…"
                  className="w-40 rounded border border-black/15 bg-transparent px-2 py-1 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
                />
              </form>
              <Link href="/recherche" className="hover:underline sm:hidden">
                Recherche
              </Link>
              <Link href="/compose" className="hover:underline">
                Écrire
              </Link>
              <Link
                href="/notifications"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Notifications
                {unread > 0 && (
                  <span
                    className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium text-background"
                    aria-label={`${unread} non lue${unread > 1 ? "s" : ""}`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              {user.role === "admin" && (
                <Link href="/admin/accounts" className="hover:underline">
                  Admin
                </Link>
              )}
              <Link href={`/@${user.handle}`} className="hover:underline">
                Profil
              </Link>
              <Link href="/preferences" className="hover:underline">
                Préférences
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded border border-black/15 px-2 py-1 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  Se déconnecter
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="rounded bg-foreground px-3 py-1 text-background hover:opacity-90"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
