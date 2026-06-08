import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Container } from "@/components/Container";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { humanObjectUrl, INSTANCE_DOMAIN } from "@/lib/config";
import { relativeTime } from "@/lib/relative-time";
import { plural, type Locale } from "@/lib/i18n/config";
import { type Messages } from "@/lib/i18n/dictionaries";
import { getServerI18n } from "@/lib/i18n/server";
import {
  markAllNotificationsReadAction,
  refreshNotificationsAction,
} from "@/app/actions/notifications";

export async function generateMetadata() {
  const { dict } = await getServerI18n();
  return { title: dict.notifications.metaTitle };
}

type NotificationRow = typeof notifications.$inferSelect;
type NotifDict = Messages["notifications"];

/** Profil de l'acteur : route locale `/@handle` si l'acteur est sur l'instance,
 *  sinon son URI ActivityPub (déréférençable vers son profil distant). */
function actorHref(handle: string, actorUri: string): string {
  const parts = handle.replace(/^@/, "").split("@");
  if (parts.length === 2 && parts[1] === INSTANCE_DOMAIN) {
    return `/@${parts[0]}`;
  }
  return actorUri;
}

function ActorAvatar({ n }: { n: NotificationRow }) {
  if (n.actorIconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={n.actorIconUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/15"
    >
      {(n.actorName?.trim() || n.actorHandle.replace(/^@/, ""))
        .charAt(0)
        .toUpperCase()}
    </span>
  );
}

/** Lien vers le profil de l'acteur (local → Link interne, distant → <a>). */
function ActorLink({ n }: { n: NotificationRow }) {
  const href = actorHref(n.actorHandle, n.actorUri);
  const label = n.actorName?.trim() || n.actorHandle;
  const className = "font-medium hover:underline";
  if (href.startsWith("/@")) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a
      href={href}
      rel="noopener noreferrer nofollow"
      target="_blank"
      className={className}
    >
      {label}
    </a>
  );
}

/** Phrase selon le type d'interaction (§4.1), au singulier ou au pluriel
 *  (notification groupée de digest, « N personnes ont … », §4.4). */
function notificationText(
  type: NotificationRow["type"],
  isPlural: boolean,
  verbs: NotifDict["verbs"],
): string {
  const form =
    (verbs as Record<string, { one: string; other: string }>)[type] ??
    verbs.other;
  return isPlural ? form.other : form.one;
}

/** Rendu par type — extensible (§4). Lien profond vers le contenu visé (§4.4). */
function NotificationLine({
  n,
  t,
  locale,
}: {
  n: NotificationRow;
  t: NotifDict;
  locale: Locale;
}) {
  const unread = n.readAt == null;
  const href = n.objectUri ? humanObjectUrl(n.objectUri) : null;
  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${
        unread ? "bg-black/[0.03] dark:bg-white/[0.05]" : ""
      }`}
    >
      <ActorAvatar n={n} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <ActorLink n={n} />
          {n.groupCount > 1 && (
            <span> {plural(locale, n.groupCount - 1, t.andOthers)}</span>
          )}{" "}
          <span>{notificationText(n.type, n.groupCount > 1, t.verbs)}</span>
          {href &&
            (href.startsWith("/") ? (
              <>
                {" — "}
                <Link href={href} className="hover:underline">
                  {t.see}
                </Link>
              </>
            ) : (
              <>
                {" — "}
                <a
                  href={href}
                  rel="noopener noreferrer nofollow"
                  className="hover:underline"
                >
                  {t.see}
                </a>
              </>
            ))}
        </p>
        <p className="text-xs text-black/55 dark:text-white/55">
          {n.actorHandle} · {relativeTime(n.createdAt, locale)}
        </p>
      </div>
      {unread && (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground"
          aria-label={t.unreadDot}
          role="img"
        />
      )}
    </li>
  );
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const items = await db.query.notifications.findMany({
    where: eq(notifications.recipientUserId, user.id),
    orderBy: [desc(notifications.createdAt)],
    limit: 100,
  });

  const unreadCount = items.filter((n) => n.readAt == null).length;
  const { locale, dict } = await getServerI18n();
  const t = dict.notifications;

  return (
    <Container>
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.title}
            {unreadCount > 0 && (
              <span className="ml-2 text-base font-normal text-black/55 dark:text-white/55">
                {plural(locale, unreadCount, t.unreadBadge)}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <form action={refreshNotificationsAction}>
              <button
                type="submit"
                className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {t.refresh}
              </button>
            </form>
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                disabled={unreadCount === 0}
                className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
              >
                {t.markAllRead}
              </button>
            </form>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-black/55 dark:text-white/55">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
            {items.map((n) => (
              <NotificationLine key={n.id} n={n} t={t} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
