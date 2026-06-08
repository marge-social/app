import Link from "next/link";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actorBlocks, follows, remoteActors, users } from "@/db/schema";
import {
  unfollowLocalAction,
  unfollowRemoteAction,
} from "@/app/actions/follows";
import { unblockActorAction } from "@/app/actions/moderation";
import { deleteAccountAction } from "@/app/actions/account";
import { saveNotificationSettingsAction } from "@/app/actions/notifications";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import {
  type InteractionNotifType,
  getEffectiveSettings,
} from "@/lib/notifications";

const NOTIF_TYPE_LABELS: Record<InteractionNotifType, string> = {
  reply: "Réponses-billets",
  comment: "Commentaires",
  announce: "Partages",
  like: "J’aime",
};
const NOTIF_TYPE_ORDER: InteractionNotifType[] = [
  "reply",
  "comment",
  "announce",
  "like",
];
const CHANNEL_OPTIONS: [string, string][] = [
  ["realtime", "Temps réel"],
  ["digest", "Digest"],
  ["off", "Désactivé"],
];
const SCOPE_OPTIONS: [string, string][] = [
  ["all", "Local + fédéré"],
  ["local", "Local seulement"],
  ["federated", "Fédéré seulement"],
];

export const metadata = { title: "Préférences — Marge" };

export default async function PreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const localFollows = await db
    .select({ id: users.id, handle: users.handle, name: users.displayName })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingUserId))
    .where(
      and(
        eq(follows.followerUserId, user.id),
        isNotNull(follows.followingUserId),
        eq(follows.status, "accepted"),
      ),
    );

  const remoteFollows = await db
    .select({
      uri: follows.followingUri,
      status: follows.status,
      name: remoteActors.name,
      handle: remoteActors.handle,
      url: remoteActors.url,
    })
    .from(follows)
    .leftJoin(remoteActors, eq(remoteActors.uri, follows.followingUri))
    .where(
      and(eq(follows.followerUserId, user.id), isNull(follows.followingUserId)),
    );

  const blocked = await db
    .select({ actorUri: actorBlocks.actorUri })
    .from(actorBlocks)
    .where(eq(actorBlocks.userId, user.id));

  const notifSettings = await getEffectiveSettings(user.id);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Préférences</h1>

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
        <p className="text-sm text-foreground/60">
          Nom, bio et avatar se modifient sur{" "}
          <Link href={`/@${user.handle}`} className="underline">
            votre profil
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Changer mon mot de passe</h2>
        <PasswordChangeForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-foreground/70">
          Pour chaque type d’interaction, choisissez quand être interrompu·e
          (temps réel), regroupé en récapitulatif (digest) ou rien (désactivé),
          et quelles origines compter. Le réseau parle normalement au Fediverse ;
          vous décidez de ce qui mérite de vous interrompre.
        </p>
        <form
          action={saveNotificationSettingsAction}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {NOTIF_TYPE_ORDER.map((type) => (
              <div
                key={type}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <span className="min-w-[9rem] flex-1 text-sm font-medium">
                  {NOTIF_TYPE_LABELS[type]}
                </span>
                <label className="flex items-center gap-1.5 text-xs">
                  <span className="text-foreground/55">Canal</span>
                  <select
                    name={`channel_${type}`}
                    defaultValue={notifSettings[type].channel}
                    className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
                  >
                    {CHANNEL_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <span className="text-foreground/55">Portée</span>
                  <select
                    name={`scope_${type}`}
                    defaultValue={notifSettings[type].scope}
                    className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
                  >
                    {SCOPE_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Enregistrer les préférences
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Comptes suivis ({localFollows.length + remoteFollows.length})
        </h2>
        {localFollows.length + remoteFollows.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Vous ne suivez aucun compte. Trouvez-en via la{" "}
            <Link href="/recherche" className="underline">
              recherche
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {localFollows.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Link href={`/@${f.handle}`} className="hover:underline">
                  {f.name}{" "}
                  <span className="font-mono text-foreground/60">
                    {fediverseHandle(f.handle)}
                  </span>
                </Link>
                <form action={unfollowLocalAction}>
                  <input type="hidden" name="targetUserId" value={f.id} />
                  <button className="text-xs text-foreground/50 underline">
                    ne plus suivre
                  </button>
                </form>
              </li>
            ))}
            {remoteFollows.map((f) => (
              <li key={f.uri} className="flex items-center gap-2">
                <a
                  href={f.url ?? f.uri}
                  className="font-mono hover:underline"
                  rel="noopener noreferrer nofollow"
                >
                  {f.handle ?? f.name ?? f.uri}
                </a>
                {f.status === "pending" && (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    (en attente)
                  </span>
                )}
                <form action={unfollowRemoteAction}>
                  <input type="hidden" name="remoteUri" value={f.uri} />
                  <button className="text-xs text-foreground/50 underline">
                    ne plus suivre
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Comptes bloqués ({blocked.length})
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {blocked.map((b) => (
              <li key={b.actorUri} className="flex items-center gap-2">
                <span className="font-mono text-foreground/60">
                  {b.actorUri}
                </span>
                <form action={unblockActorAction}>
                  <input type="hidden" name="actorUri" value={b.actorUri} />
                  <button className="text-xs text-foreground/50 underline">
                    débloquer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Exporter mes données</h2>
        <p className="text-sm text-foreground/70">
          Vos données vous appartiennent et restent portables (standards
          ouverts).
        </p>
        {/* Téléchargements (Content-Disposition) : <a> natif requis, pas <Link>. */}
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href="/api/export/markdown"
            download
            className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Mes textes (Markdown)
          </a>
          <a
            href="/api/export/opml"
            download
            className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
          >
            Mes abonnements (OPML)
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded border border-red-500/30 p-4">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
          Supprimer mon compte
        </h2>
        <p className="text-sm text-foreground/70">
          Action définitive : vos textes, abonnements et relations sont
          supprimés, et un <code>Delete</code> fédéré est envoyé aux instances
          qui vous suivent. Les flux que vous possédez redeviennent orphelins.
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
