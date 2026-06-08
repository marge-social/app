import {
  AUTHORS,
  type MockPost,
  type PostMedia as PostMediaType,
  type PostMetrics,
  type RemonteeReason,
} from "@/lib/mock/discover";
import { Avatar } from "@/components/discover/Avatar";
import { Icons } from "@/components/discover/icons";

const REASON_GLYPH: Record<RemonteeReason["kind"], string> = {
  depth: "★",
  social: "↺",
  recency: "✦",
  discovery: "✦",
  controversy: "⚖",
};

function ReasonChip({ reason }: { reason: RemonteeReason }) {
  return (
    <span className="reason" title={`Raison de la remontée : ${reason.txt}`}>
      <span className="ic" aria-hidden>
        {REASON_GLYPH[reason.kind] ?? "·"}
      </span>
      <span>
        <span className="why">Remonté&nbsp;:&nbsp;</span>
        {reason.txt}
      </span>
    </span>
  );
}

function AuthorBlock({ authorId, time }: { authorId: string; time: string }) {
  const a = AUTHORS[authorId];
  return (
    <div className="author-row">
      <Avatar name={a.name} color={a.color} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {/* TODO: lien vers le profil /@handle une fois les auteurs réels (DB/AP). */}
          <span className="author-name">{a.name}</span>
          <span className="pub-time">· {time}</span>
        </div>
        <div className="author-rep">
          <span>
            <b>{a.rep.textes}</b> textes
          </span>
          <span className="sep">·</span>
          <span>
            <b>{a.rep.citations}</b> citations reçues
          </span>
          <span className="sep">·</span>
          <span>
            <b>{a.rep.complete}%</b> lectures complètes
          </span>
        </div>
      </div>
    </div>
  );
}

function Metrics({
  m,
  withReponses = true,
  withSources = true,
}: {
  m: PostMetrics;
  withReponses?: boolean;
  withSources?: boolean;
}) {
  return (
    <div className="metrics">
      <span className="m">
        {Icons.eye} <span className="v">{m.vues}</span>
      </span>
      <span className="m">
        {Icons.heart} <span className="v">{m.reactions}</span>
      </span>
      {withReponses && m.reponses != null && (
        <span className="m">
          {Icons.reply} <span className="v">{m.reponses}</span> rép.-billets
        </span>
      )}
      {m.annotations != null && (
        <span className="m">
          {Icons.note} <span className="v">{m.annotations}</span> annot.
        </span>
      )}
      {withSources && m.sources != null && (
        <span className="m">
          {Icons.book} <span className="v">{m.sources}</span> sources
        </span>
      )}
    </div>
  );
}

function CardActions({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <div className="card-actions">
      <button
        type="button"
        className="ico-btn"
        data-on={saved}
        aria-pressed={saved}
        aria-label={saved ? "Retirer des textes enregistrés" : "Enregistrer ce texte"}
        onClick={onSave}
      >
        {Icons.bookmark}
      </button>
      {/* TODO: câbler le partage (Announce) — stub visuel pour l'instant. */}
      <button type="button" className="ico-btn" aria-label="Partager" disabled>
        {Icons.share}
      </button>
    </div>
  );
}

function PostMedia({ media }: { media?: PostMediaType }) {
  if (!media) return null;
  if (media.kind === "img") {
    return (
      <div className="media-img" role="img" aria-label={media.caption ?? "illustration"}>
        <div className="ph">
          <span className="cap">{media.caption ?? "illustration"}</span>
        </div>
        {media.credit && <span className="credit">{media.credit}</span>}
      </div>
    );
  }
  if (media.kind === "video") {
    return (
      // TODO: brancher le vrai lecteur (VideoPlayer) sur des médias distants réels.
      <div className="media-video" role="img" aria-label={`Vidéo : ${media.caption ?? media.label}`}>
        <div className="vph" />
        <div className="play" aria-hidden />
        <div className="timeline">
          {media.annotations.map((p, i) => (
            <span key={i} className="tick" style={{ left: `${p * 100}%` }} />
          ))}
        </div>
        <div className="v-bar">
          <span className="dur">{media.duration}</span>
          <span className="lbl">{media.label}</span>
          <span className="annot">{media.annotations.length} annotations</span>
        </div>
      </div>
    );
  }
  // Document (PDF…)
  const ext = (media.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "DOC").toUpperCase();
  return (
    // TODO: lien réel vers la pièce jointe une fois le stockage S3 branché.
    <span className="doc-attach" role="group" aria-label={`Document : ${media.name}`}>
      <span className="doc-ic" aria-hidden>
        {ext}
      </span>
      <span className="doc-meta">
        <span className="doc-name">{media.name}</span>
        <span className="doc-sub">{media.sub}</span>
      </span>
    </span>
  );
}

function Excerpt({ children }: { children: string }) {
  return (
    <p className="excerpt">
      {children}
      <span className="more"> … lire la suite</span>
    </p>
  );
}

const FMT_PILL: Record<MockPost["fmt"], string> = {
  billet: "Billet",
  note: "Note brève",
  analyse: "Analyse",
  video: "Vidéo commentée",
};

export interface PostCardProps {
  post: MockPost;
  saved: boolean;
  onSave: () => void;
}

/**
 * Carte de statut/post — unité centrale du fil. Variante par format (billet,
 * note brève, analyse, vidéo commentée). Compteurs publics et honnêtes, jamais
 * de tri par engagement. Titres/auteurs non navigants en pré-bêta (données démo).
 */
export function PostCard({ post, saved, onSave }: PostCardProps) {
  const isNote = post.fmt === "note";
  // Analyse & vidéo affichent toutes les raisons ; billet & note, la principale.
  const reasons = post.fmt === "analyse" || post.fmt === "video" ? post.reasons : post.reasons.slice(0, 1);

  return (
    <article className={`card card-${post.fmt}`}>
      <div className="card-meta-row">
        <span className="fmt-pill" data-fmt={post.fmt}>
          {FMT_PILL[post.fmt]}
        </span>
        <AuthorBlock authorId={post.author} time={post.publishedAgo} />
      </div>

      {isNote ? (
        <p className="note-body">{post.body}</p>
      ) : (
        <>
          {/* TODO: lien vers le permalien de l'article une fois la route câblée. */}
          {post.title && <h2 className="ttl">{post.title}</h2>}
          {post.chapo && <p className="chapo">{post.chapo}</p>}
          <PostMedia media={post.media} />
          {post.excerpt && <Excerpt>{post.excerpt}</Excerpt>}
          {post.pull && <blockquote className="pull">« {post.pull} »</blockquote>}
        </>
      )}

      <div className="card-foot">
        <Metrics m={post.metrics} withReponses={!isNote} withSources={!isNote} />
        {reasons.map((r, i) => (
          <ReasonChip key={i} reason={r} />
        ))}
        <CardActions saved={saved} onSave={onSave} />
      </div>
    </article>
  );
}
