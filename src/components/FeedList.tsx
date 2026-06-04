import Link from "next/link";
import type { CommentView, FeedEntry } from "@/lib/feed";
import {
  createCommentAction,
  toggleAnnounceAction,
  toggleLikeAction,
} from "@/app/actions/interactions";
import { relativeTimeFr } from "@/lib/relative-time";

function EntryMeta({ e }: { e: FeedEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
      <span>{e.authorLabel}</span>
      <span aria-hidden>·</span>
      <time dateTime={e.date.toISOString()}>
        {e.date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </time>
      <span aria-hidden>·</span>
      <span>{e.source}</span>
      {e.readingMinutes && (
        <>
          <span aria-hidden>·</span>
          <span>{e.readingMinutes} min</span>
        </>
      )}
    </div>
  );
}

/**
 * Like discret et réversible (§2.1, §6). Bascule en un clic via une action
 * serveur (le champ `liked` porte l'état voulu = inverse de l'état courant).
 * Le compteur n'apparaît qu'à partir de 1 — visible de tous (décision §8 opt.
 * c), jamais utilisé pour trier, et sans « 0 » anxiogène en course.
 */
function LikeButton({ e }: { e: FeedEntry }) {
  if (!e.objectUri) return null;
  return (
    <form action={toggleLikeAction} className="flex">
      <input type="hidden" name="objectIri" value={e.objectUri} />
      <input type="hidden" name="liked" value={(!e.likedByViewer).toString()} />
      <button
        type="submit"
        aria-pressed={e.likedByViewer}
        aria-label={e.likedByViewer ? "Retirer le like" : "Aimer"}
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
          e.likedByViewer ? "text-rose-600 dark:text-rose-400" : "text-foreground/55"
        }`}
      >
        <span aria-hidden className="text-sm leading-none">
          {e.likedByViewer ? "♥" : "♡"}
        </span>
        {e.likeCount > 0 && (
          <span className="tabular-nums">{e.likeCount}</span>
        )}
      </button>
    </form>
  );
}

/**
 * Partage discret et réversible (§2.4, §6). Réémet l'objet vers les abonnés.
 * Compteur visible de tous (§8 opt. c) mais jamais utilisé pour trier (§6) ;
 * masqué à 0. Le champ `shared` porte l'état voulu (inverse de l'état courant).
 */
function ShareButton({ e }: { e: FeedEntry }) {
  if (!e.objectUri) return null;
  return (
    <form action={toggleAnnounceAction} className="flex">
      <input type="hidden" name="objectIri" value={e.objectUri} />
      <input
        type="hidden"
        name="shared"
        value={(!e.sharedByViewer).toString()}
      />
      <button
        type="submit"
        aria-pressed={e.sharedByViewer}
        aria-label={e.sharedByViewer ? "Ne plus partager" : "Partager"}
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
          e.sharedByViewer
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground/55"
        }`}
      >
        <span aria-hidden className="text-sm leading-none">
          ↻
        </span>
        {e.shareCount > 0 && (
          <span className="tabular-nums">{e.shareCount}</span>
        )}
      </button>
    </form>
  );
}

/**
 * Une réponse dans le fil threadé : commentaire court en entier (§2.2), ou
 * réponse-billet en référence titrée vers la publication autonome (§2.3).
 */
function CommentItem({ c }: { c: CommentView }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/55">
        {c.internal && c.authorHandle ? (
          <Link href={`/@${c.authorHandle}`} className="hover:underline">
            {c.authorLabel}
          </Link>
        ) : (
          <span>{c.authorLabel}</span>
        )}
        <span aria-hidden>·</span>
        <time dateTime={c.date.toISOString()}>{relativeTimeFr(c.date)}</time>
      </div>
      {c.title ? (
        <p className="text-sm">
          <span className="text-foreground/55">↳ Réponse-billet : </span>
          {c.internal ? (
            <Link href={c.href} className="font-medium hover:underline">
              {c.title}
            </Link>
          ) : (
            <a
              href={c.href}
              rel="noopener noreferrer nofollow"
              className="font-medium hover:underline"
            >
              {c.title}
            </a>
          )}
        </p>
      ) : (
        <div
          className="prose-marge text-sm"
          dangerouslySetInnerHTML={{ __html: c.contentHtml }}
        />
      )}
    </li>
  );
}

/**
 * Fil de commentaires courts + champ de réponse, affiché **sous** le contenu
 * (§2.2, logique threadée). Le champ est limité à 500 caractères pour le
 * distinguer de la réponse-billet. Réponse en un envoi (action serveur).
 */
function CommentThread({ e }: { e: FeedEntry }) {
  if (!e.objectUri) return null;
  return (
    <div className="mt-1 flex flex-col gap-3 border-l-2 border-black/5 pl-3 dark:border-white/10">
      {e.comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {e.comments.map((c) => (
            <CommentItem key={c.key} c={c} />
          ))}
        </ul>
      )}
      <form action={createCommentAction} className="flex flex-col gap-1.5">
        <input type="hidden" name="objectIri" value={e.objectUri} />
        <label htmlFor={`comment-${e.key}`} className="sr-only">
          Commenter
        </label>
        <textarea
          id={`comment-${e.key}`}
          name="body"
          rows={1}
          maxLength={500}
          required
          placeholder="Commenter…"
          className="w-full resize-y rounded border border-black/10 bg-transparent px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-foreground/30 focus:outline-none dark:border-white/15"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded px-2.5 py-1 text-xs text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Commenter
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Rendu du fil unifié (§Lot 3). Les notes natives sont affichées **en entier** ;
 * les billets, contenus distants et items RSS en **aperçu + lien**. Aucun
 * compteur d'engagement classant n'est rendu ; seul un like discret (§2.1).
 */
export function FeedList({ entries }: { entries: FeedEntry[] }) {
  return (
    <ul className="flex flex-col gap-6">
      {entries.map((e) => (
        <li
          key={e.key}
          className="flex flex-col gap-2 border-b border-black/5 pb-5 dark:border-white/10"
        >
          {e.sharedBy && (
            <p className="flex items-center gap-1.5 text-xs text-foreground/55">
              <span aria-hidden>↻</span>
              <span>partagé par {e.sharedBy}</span>
            </p>
          )}
          <EntryMeta e={e} />
          {e.kind === "note" ? (
            <>
              <div
                className="prose-marge text-sm"
                dangerouslySetInnerHTML={{ __html: e.contentHtml ?? "" }}
              />
              <Link
                href={e.href}
                className="text-xs text-foreground/55 hover:underline"
              >
                Permalien
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">
                {e.internal ? (
                  <Link href={e.href} className="hover:underline">
                    {e.title || "(sans titre)"}
                  </Link>
                ) : (
                  <a
                    href={e.href}
                    className="hover:underline"
                    rel="noopener noreferrer nofollow"
                  >
                    {e.title || "(sans titre)"}
                  </a>
                )}
              </h3>
              {e.summary && (
                <p className="text-sm text-foreground/80">{e.summary}</p>
              )}
            </>
          )}
          {e.objectUri && (
            <>
              <div className="mt-1 flex items-center gap-3">
                <LikeButton e={e} />
                <ShareButton e={e} />
                <Link
                  href={`/compose?replyTo=${encodeURIComponent(e.objectUri)}`}
                  className="rounded px-1.5 py-0.5 text-xs text-foreground/55 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Répondre par un billet
                </Link>
              </div>
              <CommentThread e={e} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
