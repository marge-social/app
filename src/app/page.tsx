import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import { buildFeed } from "@/lib/feed";
import { Composer } from "@/components/Composer";
import { FeedList } from "@/components/FeedList";

const PAGE_SIZE = 20;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const user = await getCurrentUser();

  // Visiteur non connecté : page de présentation.
  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Un média social pour le débat démocratique.
        </h1>
        <p className="text-lg text-foreground/80">
          Marge est un média social à contre-courant de l’économie
          attentionnelle : on y publie des textes long, on agrège des flux
          qu’on a choisis, et tout est nativement fédéré et interopérable
          (ActivityPub).
        </p>
        <p className="text-lg text-foreground/80">
          En ce moment, on pose les fondations. Vous pouvez vous inscrire, mais
          c’est encore peu utilisable.
        </p>
        <div className="flex gap-3">
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
        </div>
      </div>
    );
  }

  // Utilisateur connecté : fil unifié + composer.
  const { n } = await searchParams;
  const pages = Math.max(1, Math.min(20, Number.parseInt(n ?? "1", 10) || 1));
  const limit = pages * PAGE_SIZE;
  const { entries, hasMore } = await buildFeed(user, { limit });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Fil</h1>
        <p className="text-sm text-foreground/70">
          <span className="font-mono">{fediverseHandle(user.handle)}</span> —
          comptes et flux suivis, mêlés en ordre chronologique.
        </p>
      </header>

      <Composer />

      <section className="flex flex-col gap-6" aria-label="Fil">
        {entries.length === 0 ? (
          <p className="text-foreground/60">
            Ton fil est vide. Écris un premier message ci-dessus, ou utilise la{" "}
            <Link href="/recherche" className="underline">
              recherche
            </Link>{" "}
            pour suivre des comptes et des flux.
          </p>
        ) : (
          <>
            <FeedList entries={entries} />
            {hasMore && (
              <Link
                href={`/?n=${pages + 1}`}
                scroll={false}
                className="self-center rounded border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Charger plus
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
