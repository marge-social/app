import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { INSTANCE_DOMAIN } from "@/lib/config";
import { relativeTimeFr } from "@/lib/relative-time";
import {
  markAllNotificationsReadAction,
  refreshNotificationsAction,
} from "@/app/actions/notifications";

export const metadata = { title: "Notifications — Marge" };

type NotificationRow = typeof notifications.$inferSelect;

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

/** Rendu par type — extensible (§2.6). V1 n'émet que `follow`. */
function NotificationLine({ n }: { n: NotificationRow }) {
  const unread = n.readAt == null;
  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${
        unread ? "bg-black/[0.03] dark:bg-white/[0.05]" : ""
      }`}
    >
      <ActorAvatar n={n} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <ActorLink n={n} />{" "}
          {n.type === "follow" ? (
            <span>vous suit</span>
          ) : (
            <span>a interagi avec vous</span>
          )}
        </p>
        <p className="text-xs text-black/55 dark:text-white/55">
          {n.actorHandle} · {relativeTimeFr(n.createdAt)}
        </p>
      </div>
      {unread && (
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground"
          aria-label="Non lue"
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

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-base font-normal text-black/55 dark:text-white/55">
              {unreadCount} non&nbsp;lue{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <form action={refreshNotificationsAction}>
            <button
              type="submit"
              className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Rafraîchir
            </button>
          </form>
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              disabled={unreadCount === 0}
              className="rounded border border-black/15 px-3 py-1 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              Tout marquer comme lu
            </button>
          </form>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-black/55 dark:text-white/55">
          Aucune notification pour le moment. Vous serez prévenu·e quand un
          compte se mettra à vous suivre.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {items.map((n) => (
            <NotificationLine key={n.id} n={n} />
          ))}
        </ul>
      )}
    </section>
  );
}
