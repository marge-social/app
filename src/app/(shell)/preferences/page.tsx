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
import { Container } from "@/components/Container";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { getCurrentUser } from "@/lib/auth";
import { fediverseHandle } from "@/lib/config";
import {
  type InteractionNotifType,
  getEffectiveSettings,
} from "@/lib/notifications";
import { getServerI18n } from "@/lib/i18n/server";

const NOTIF_TYPE_ORDER: InteractionNotifType[] = [
  "reply",
  "comment",
  "announce",
  "like",
];
const CHANNEL_KEYS = ["realtime", "digest", "off"] as const;
const SCOPE_KEYS = ["all", "local", "federated"] as const;

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.preferences.metaTitle };
}

export default async function PreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { dict } = await getServerI18n();
  const t = dict.preferences;

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
    <Container>
      <div className="flex flex-col gap-8">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.accountSection}</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
            <dt className="text-foreground/60">{t.displayName}</dt>
            <dd>{user.displayName}</dd>
            <dt className="text-foreground/60">{t.federatedHandle}</dt>
            <dd className="font-mono">{fediverseHandle(user.handle)}</dd>
            <dt className="text-foreground/60">{t.email}</dt>
            <dd>{user.email}</dd>
          </dl>
          <p className="text-sm text-foreground/60">
            {t.editProfileBefore}{" "}
            <Link href={`/@${user.handle}`} className="underline">
              {t.editProfileLink}
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t.changePasswordSection}</h2>
          <PasswordChangeForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t.notificationsSection}</h2>
          <p className="text-sm text-foreground/70">{t.notificationsIntro}</p>
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
                    {t.typeLabels[type]}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-foreground/55">{t.channel}</span>
                    <select
                      name={`channel_${type}`}
                      defaultValue={notifSettings[type].channel}
                      className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
                    >
                      {CHANNEL_KEYS.map((v) => (
                        <option key={v} value={v}>
                          {t.channelOptions[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-foreground/55">{t.scope}</span>
                    <select
                      name={`scope_${type}`}
                      defaultValue={notifSettings[type].scope}
                      className="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
                    >
                      {SCOPE_KEYS.map((v) => (
                        <option key={v} value={v}>
                          {t.scopeOptions[v]}
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
              {t.savePreferences}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {t.followedAccounts} ({localFollows.length + remoteFollows.length})
          </h2>
          {localFollows.length + remoteFollows.length === 0 ? (
            <p className="text-sm text-foreground/60">
              {t.noFollowsBefore}{" "}
              <Link href="/recherche" className="underline">
                {t.noFollowsLink}
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
                      {t.unfollow}
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
                      {t.followPending}
                    </span>
                  )}
                  <form action={unfollowRemoteAction}>
                    <input type="hidden" name="remoteUri" value={f.uri} />
                    <button className="text-xs text-foreground/50 underline">
                      {t.unfollow}
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
              {t.blockedAccounts} ({blocked.length})
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
                      {t.unblock}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t.exportSection}</h2>
          <p className="text-sm text-foreground/70">{t.exportIntro}</p>
          {/* Téléchargements (Content-Disposition) : <a> natif requis, pas <Link>. */}
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/api/export/markdown"
              download
              className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              {t.exportMarkdown}
            </a>
            <a
              href="/api/export/opml"
              download
              className="rounded border border-black/20 px-3 py-1.5 hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
            >
              {t.exportOpml}
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded border border-red-500/30 p-4">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
            {t.deleteSection}
          </h2>
          <p className="text-sm text-foreground/70">
            {t.deleteWarnBefore} <code>Delete</code> {t.deleteWarnAfter}
          </p>
          <form action={deleteAccountAction} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              {t.deleteConfirm}
            </label>
            <button
              type="submit"
              className="w-fit rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
            >
              {t.deleteButton}
            </button>
          </form>
        </section>
      </div>
    </Container>
  );
}
