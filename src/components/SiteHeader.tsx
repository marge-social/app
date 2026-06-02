import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

/** En-tête global. Navigation minimale, sans compteur ni dark pattern. */
export async function SiteHeader() {
  const user = await getCurrentUser();

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
              <Link href="/feed" className="hover:underline">
                Mon fil
              </Link>
              <Link href="/feeds" className="hover:underline">
                Flux
              </Link>
              <Link href="/compose" className="hover:underline">
                Écrire
              </Link>
              <Link href={`/@${user.handle}`} className="hover:underline">
                Profil
              </Link>
              <Link href="/settings" className="hover:underline">
                Réglages
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
