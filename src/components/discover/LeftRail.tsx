import { ME } from "@/lib/mock/discover";
import { Avatar } from "@/components/discover/Avatar";

/** Rail gauche — carte profil « moi », navigation personnelle, sujets suivis,
 *  reprise de lecture. Présentationnel (données démo). Les liens sont des
 *  ancres inertes en pré-bêta. */
export function LeftRail() {
  const { author, drafts, saved, replies, annotations, topics, resume } = ME;
  return (
    <aside className="rail-left" aria-label="Mon espace">
      <div className="me-card">
        <div className="me-head">
          <Avatar name={author.name} color={author.color} size={44} />
          <div className="min-w-0">
            <div className="me-name">{author.name}</div>
            <div className="me-handle">{author.handle}</div>
          </div>
        </div>
        <div className="me-stats">
          <div className="me-stat">
            <div className="v">{author.rep.textes}</div>
            <div className="l">textes publiés</div>
          </div>
          <div className="me-stat">
            <div className="v">{author.rep.citations}</div>
            <div className="l">citations reçues</div>
          </div>
          <div className="me-stat">
            <div className="v">{author.rep.complete}%</div>
            <div className="l">lectures complètes</div>
          </div>
          <div className="me-stat">
            <div className="v">{author.rep.abonnes}</div>
            <div className="l">abonnés fidèles</div>
          </div>
        </div>
      </div>

      {/* TODO: câbler ces liens (brouillons, enregistrés, réponses, annotations…). */}
      <nav className="nav-side" aria-label="Mon espace">
        <h4>Mon espace</h4>
        <a href="#">
          <span>Mon fil personnalisé</span>
        </a>
        <a href="#">
          <span>Mes brouillons</span>
          <span className="ct">{drafts}</span>
        </a>
        <a href="#">
          <span>Textes enregistrés</span>
          <span className="ct">{saved}</span>
        </a>
        <a href="#">
          <span>Mes réponses-billets</span>
          <span className="ct">{replies}</span>
        </a>
        <a href="#">
          <span>Annotations</span>
          <span className="ct">{annotations}</span>
        </a>
        <a href="#">
          <span>Historique de lecture</span>
        </a>
      </nav>

      <div className="nav-side">
        <h4>Sujets que je suis</h4>
        <div className="topic-tag-list" style={{ marginTop: 2 }}>
          {topics.map((t) => (
            <a key={t} className="topic-tag" href="#">
              {t}
            </a>
          ))}
          <a className="topic-tag" href="#">
            + ajouter
          </a>
        </div>
      </div>

      <div className="nav-side">
        <h4>Reprendre la lecture</h4>
        <a href="#" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--serif)",
              fontSize: 13.5,
              color: "var(--ink)",
              lineHeight: 1.3,
            }}
          >
            {resume.title}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {resume.author} · {resume.progress}
          </span>
        </a>
      </div>
    </aside>
  );
}
