"use client";

import { useT } from "@/components/I18nProvider";
import type { EditorFormat, EditorStats } from "@/lib/editor/serialize";

/**
 * Modale « comment ce texte sera classé » — illustrative : l'algorithme est
 * présenté décomposé et pondéré (jamais agrégé en score caché). Les poids sont
 * statiques (non localisés) ; les libellés viennent de l'i18n.
 */
export function TransparencyModal({
  stats,
  format,
  onClose,
}: {
  stats: EditorStats;
  format: EditorFormat;
  onClose: () => void;
}) {
  const { t, plural } = useT();
  const tr = t.editor.transparency;
  const sig = tr.signals;

  const rows: { n: string; d: string; w: number; weak?: boolean }[] = [
    { ...sig.replies, w: 9 },
    { ...sig.readRate, w: 8 },
    { ...sig.crossRefs, w: 8 },
    { ...sig.annotations, w: 6 },
    { ...sig.sources, w: 5 },
    { ...sig.loyalty, w: 5 },
    { ...sig.likes, w: 1, weak: true },
    { ...sig.immediacy, w: 1, weak: true },
  ];
  void format; // le format n'influence pas l'affichage (illustratif).
  const maxW = 10;

  const marge = stats.hasMargeRef ? tr.whyMargeClause : "";
  const why =
    stats.sourceCount > 0
      ? plural(stats.sourceCount, tr.whyHasSources, {
          n: stats.sourceCount,
          marge,
        })
      : tr.whyNoSources;
  const structured =
    stats.readingMinutes >= 3 && stats.hasStructure ? tr.whyStructured : "";

  return (
    <div className="ae-modal-scrim" onClick={onClose}>
      <div className="ae-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>{tr.title}</h3>
          <button className="x" onClick={onClose} aria-label={tr.close}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="transparency-intro">{tr.intro}</p>
          {rows.map((s, i) => (
            <div key={i} className={"signal-row " + (s.weak ? "weak" : "")}>
              <span className="ic">{s.weak ? "·" : "★"}</span>
              <div>
                <div className="nm">{s.n}</div>
                <div className="desc">{s.d}</div>
              </div>
              <div className="signal-meta">
                <div className="bar">
                  <i style={{ width: (s.w / maxW) * 100 + "%" }} />
                </div>
                <span className="wt">×{s.w}</span>
              </div>
            </div>
          ))}

          <div className="why-this-rank">
            <strong>{tr.whyLabel}</strong> {why}
            {structured}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {tr.close}
          </button>
        </div>
      </div>
    </div>
  );
}
