"use client";

import { useT } from "@/components/I18nProvider";
import type { Source } from "@/lib/editor/serialize";

/** Rail des sources : dans l'ordre d'apparition, une note numérotée chacune. */
export function SourcesRail({
  sources,
  onRemove,
  onAdd,
}: {
  sources: Source[];
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useT();
  const p = t.editor.sourcesPanel;

  return (
    <div className="panel">
      <p className="panel-title">
        {p.title}
        <span
          style={{
            color: "var(--ink-3)",
            fontWeight: 400,
            fontSize: 11.5,
            marginLeft: 4,
          }}
        >
          · {sources.length}
        </span>
      </p>
      <p className="panel-sub">{p.sub}</p>
      {sources.length > 0 && (
        <ul className="sources-list">
          {sources.map((s, i) => (
            <li key={s.id} className="src-item">
              <span className="num">{i + 1}</span>
              <div className="meta">
                <div className="ttl">{s.title || s.url || p.untitled}</div>
                <div className="aux">
                  <span className="kind">{p.kinds[s.kind]}</span>
                  {s.author && <span>{s.author}</span>}
                  {s.year && <span>· {s.year}</span>}
                </div>
              </div>
              <button
                type="button"
                className="x"
                aria-label={p.removeSource}
                onClick={() => onRemove(s.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="add-src" onClick={onAdd}>
        <span className="plus">+</span> {p.addSource}
      </button>
    </div>
  );
}
