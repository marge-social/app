import Link from "next/link";
import type { CommentView, FeedEntry } from "@/lib/feed";
import type { Messages } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { relativeTime } from "@/lib/relative-time";
import { Attachments } from "@/components/Attachments";
import { NoteBody } from "@/components/NoteBody";
import { Avatar } from "@/components/discover/Avatar";
import { Icons } from "@/components/discover/icons";
import {
  createCommentAction,
  toggleAnnounceAction,
  toggleLikeAction,
} from "@/app/actions/interactions";

type FeedDict = Messages["feed"];

// Pastille d'avatar : couleur déterministe dérivée de l'auteur (les vrais
// avatars image ne sont pas chargés dans le fil pour éviter les requêtes/casses).
const DOT_COLORS = [
  "#7A4A22",
  "#3F6F8F",
  "#7E5C8E",
  "#406B4A",
  "#8B3A1F",
  "#5A5A2A",
  "#6E4A4A",
  "#1F4E7A",
];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DOT_COLORS[h % DOT_COLORS.length];
}

/** Format affiché (pastille) à partir du type d'entrée + des médias. */
function formatOf(e: FeedEntry): { fmt: string; label: string } {
  if (e.kind === "note") return { fmt: "note", label: "Note brève" };
  if (e.kind === "article") return { fmt: "billet", label: "Billet" };
  if (e.kind === "rss") return { fmt: "note", label: "Source" };
  // remote
  if (e.media.some((m) => m.kind === "video")) return { fmt: "video", label: "Vidéo" };
  return e.title
    ? { fmt: "billet", label: "Distant" }
    : { fmt: "note", label: "Note distante" };
}

function authorName(label: string): string {
  return label.split(" · ")[0] || label;
}

function TitleLink({ e, dict }: { e: FeedEntry; dict: FeedDict }) {
  const label = e.title || dict.untitled;
  if (e.internal) {
    return (
      <Link href={e.href} className="ttl-link">
        <h2 className="ttl">{label}</h2>
      </Link>
    );
  }
  return (
    <a href={e.href} className="ttl-link" rel="noopener noreferrer nofollow">
      <h2 className="ttl">{label}</h2>
    </a>
  );
}

function CommentItem({
  c,
  dict,
  locale,
}: {
  c: CommentView;
  dict: FeedDict;
  locale: Locale;
}) {
  return (
    <li className="entry-comment">
      <div className="who">
        {c.internal && c.authorHandle ? (
          <Link href={`/@${c.authorHandle}`}>{c.authorLabel}</Link>
        ) : (
          <span>{c.authorLabel}</span>
        )}{" "}
        · <time dateTime={c.date.toISOString()}>{relativeTime(c.date, locale)}</time>
      </div>
      {c.title ? (
        <p className="ref">
          ↳ {dict.articleReplyPrefix}{" "}
          {c.internal ? (
            <Link href={c.href}>{c.title}</Link>
          ) : (
            <a href={c.href} rel="noopener noreferrer nofollow">
              {c.title}
            </a>
          )}
        </p>
      ) : (
        // contentHtml est déjà sanitisé en amont (lib/feed).
        <div className="body" dangerouslySetInnerHTML={{ __html: c.contentHtml }} />
      )}
    </li>
  );
}

/**
 * Une entrée du fil unifié réel rendue dans le style éditorial « Découvrir ».
 * Mappe `FeedEntry` (note/billet/distant/RSS) sur la carte du design, avec les
 * **vraies** interactions (like/partage/réponse/commentaires) câblées sur les
 * server actions existantes. Aucun classement, aucun compteur d'engagement
 * utilisé pour trier (§6/§8c) ; compteurs masqués à 0.
 */
export function FeedEntryCard({
  e,
  dict,
  locale,
}: {
  e: FeedEntry;
  dict: FeedDict;
  locale: Locale;
}) {
  const { fmt, label } = formatOf(e);
  const name = authorName(e.authorLabel);
  const isNote = e.kind === "note";

  return (
    <article className={`card card-${fmt}`}>
      <div className="card-meta-row">
        <span className="fmt-pill" data-fmt={fmt}>
          {label}
        </span>
        <div className="author-row">
          <Avatar
            name={name}
            color={colorFor(e.authorHandle ?? e.authorLabel)}
            src={e.avatarUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              {e.authorHandle ? (
                <Link href={`/@${e.authorHandle}`} className="author-name">
                  {name}
                </Link>
              ) : (
                <span className="author-name">{name}</span>
              )}
              <span className="pub-time">· {relativeTime(e.date, locale)}</span>
            </div>
            <div className="author-rep">
              <span>{dict.sources[e.source]}</span>
              {e.readingMinutes ? (
                <>
                  <span className="sep">·</span>
                  <span>{e.readingMinutes} min</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isNote ? (
        <NoteBody
          html={e.contentHtml ?? ""}
          postId={e.postId}
          contentMarkdown={e.contentMarkdown}
          canEdit={e.isOwn}
        />
      ) : (
        <>
          <TitleLink e={e} dict={dict} />
          {e.summary && <p className="excerpt">{e.summary}</p>}
        </>
      )}

      <Attachments media={e.media} />

      <div className="card-foot">
        <div className="card-actions">
          {e.objectUri && (
            <>
              <form action={toggleLikeAction} className="contents">
                <input type="hidden" name="objectIri" value={e.objectUri} />
                <input type="hidden" name="liked" value={(!e.likedByViewer).toString()} />
                <button
                  type="submit"
                  className="ico-btn"
                  data-on={e.likedByViewer}
                  aria-pressed={e.likedByViewer}
                  aria-label={e.likedByViewer ? dict.unlike : dict.like}
                >
                  {Icons.heart}
                  {e.likeCount > 0 && <span className="ct">{e.likeCount}</span>}
                </button>
              </form>

              <form action={toggleAnnounceAction} className="contents">
                <input type="hidden" name="objectIri" value={e.objectUri} />
                <input type="hidden" name="shared" value={(!e.sharedByViewer).toString()} />
                <button
                  type="submit"
                  className="ico-btn"
                  data-on={e.sharedByViewer}
                  aria-pressed={e.sharedByViewer}
                  aria-label={e.sharedByViewer ? dict.unshare : dict.share}
                >
                  {Icons.share}
                  {e.shareCount > 0 && <span className="ct">{e.shareCount}</span>}
                </button>
              </form>

              <Link
                href={`/compose?replyTo=${encodeURIComponent(e.objectUri)}`}
                className="ico-btn"
                aria-label={dict.replyWithArticle}
                title={dict.replyWithArticle}
              >
                {Icons.reply}
              </Link>
            </>
          )}
        </div>
      </div>

      {e.objectUri && (
        <div className="entry-comments">
          {e.comments.length > 0 && (
            <ul className="flex flex-col gap-3">
              {e.comments.map((c) => (
                <CommentItem key={c.key} c={c} dict={dict} locale={locale} />
              ))}
            </ul>
          )}
          <form action={createCommentAction} className="comment-form">
            <input type="hidden" name="objectIri" value={e.objectUri} />
            <label htmlFor={`comment-${e.key}`} className="sr-only">
              {dict.comment}
            </label>
            <textarea
              id={`comment-${e.key}`}
              name="body"
              rows={1}
              maxLength={500}
              required
              placeholder={dict.commentPlaceholder}
            />
            <button type="submit" className="submit">
              {dict.comment}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
