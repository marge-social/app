import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { feeds } from "@/db/schema";
import { ReferenceFeedForm } from "@/components/ReferenceFeedForm";
import { deleteAccountAction } from "@/app/actions/account";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ownedFeeds = await db.query.feeds.findMany({
    where: eq(feeds.ownerId, user.id),
    columns: {
      id: true,
      title: true,
      feedUrl: true,
      fullTextAllowed: true,
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Compte</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
          <dt className="text-foreground/60">Nom affiché</dt>
          <dd>{user.displayName}</dd>
          <dt className="text-foreground/60">Handle fédéré</dt>
          <dd className="font-mono">{fediverseHandle(user.handle)}</dd>
          <dt className="text-foreground/60">Email</dt>
          <dd>{user.email}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mes flux RSS déclarés</h2>
        {ownedFeeds.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Aucun flux déclaré. Référence un flux ci-dessous puis prouve que tu
            le contrôles (jeton) sur sa page pour le rattacher à ton compte.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {ownedFeeds.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Link href={`/feeds/${f.id}`} className="font-medium hover:underline">
                  {f.title || f.feedUrl}
                </Link>
                <span className="text-xs text-foreground/60">
                  {f.fullTextAllowed ? "texte intégral activé" : "extrait + lien"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Exporter mes données</h2>
        <p className="text-sm text-foreground/70">
          Tes données t’appartiennent et restent portables (standards ouverts).
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href="/api/export/markdown"
            className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Mes textes (Markdown)
          </a>
          <a
            href="/api/export/opml"
            className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Mes abonnements (OPML)
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Déclarer un flux</h2>
        <p className="text-sm text-foreground/70">
          Référence l’adresse de ton blog ou de ton flux : tu pourras ensuite le
          réclamer (preuve de contrôle par jeton) depuis sa page.
        </p>
        <ReferenceFeedForm />
      </section>

      <section className="flex flex-col gap-3 rounded border border-red-500/30 p-4">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
          Supprimer mon compte
        </h2>
        <p className="text-sm text-foreground/70">
          Action définitive : tes textes, abonnements et relations sont
          supprimés, et un <code>Delete</code> fédéré est envoyé aux instances
          qui te suivent. Les flux que tu possèdes redeviennent orphelins.
        </p>
        <form action={deleteAccountAction} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" required />
            Je comprends que cette action est irréversible.
          </label>
          <button
            type="submit"
            className="w-fit rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
          >
            Supprimer définitivement mon compte
          </button>
        </form>
      </section>
    </div>
  );
}
