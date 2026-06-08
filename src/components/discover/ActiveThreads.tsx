import { THREADS } from "@/lib/mock/discover";

/** Rail droit — « Conversations en cours » : un texte source et la réponse-billet
 *  qu'il a suscitée. Présentationnel (données démo). */
export function ActiveThreads() {
  return (
    <div className="panel">
      <h3>Conversations en cours</h3>
      {THREADS.map((t, i) => (
        <div key={i} className="thread-item">
          {/* TODO: liens vers les permaliens des deux textes. */}
          <div className="ttl">{t.source.title}</div>
          <div className="who">par {t.source.author}</div>
          <div className="arrow" aria-hidden>
            ↳
          </div>
          <div className="resp">{t.reply.title}</div>
          <div className="who">par {t.reply.author}</div>
          <div className="ctx">{t.context}</div>
        </div>
      ))}
    </div>
  );
}
