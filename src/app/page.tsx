import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Des textes longs, sourcés, fédérés.
      </h1>
      <p className="text-lg text-foreground/80">
        Marge est un média social à contre-courant de l’économie attentionnelle :
        on y publie des textes argumentés, on agrège des flux qu’on a choisis, et
        tout est nativement fédéré (ActivityPub) — suivable depuis Mastodon.
      </p>
      <div className="flex gap-3">
        {user ? (
          <Link
            href="/feed"
            className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
          >
            Aller à mon fil
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90"
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="rounded border border-black/20 px-4 py-2 font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              Se connecter
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
