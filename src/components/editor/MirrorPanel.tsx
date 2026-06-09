"use client";

import { useT } from "@/components/I18nProvider";
import type {
  EditorFormat,
  EditorStats,
  SuggestionKey,
} from "@/lib/editor/serialize";

/**
 * Panneau « miroir » : reflet qualitatif (stats + signaux on/off), sans note ni
 * pourcentage. Plus une suggestion contextuelle et des nudges de format.
 */
export function MirrorPanel({
  stats,
  format,
  suggestion,
}: {
  stats: EditorStats;
  format: EditorFormat;
  suggestion: SuggestionKey | null;
}) {
  const { t, plural, interpolate } = useT();
  const m = t.editor.mirror;
  const s = m.signals;

  const signals = [
    {
      key: "sources",
      on: stats.sourceCount > 0,
      name: s.sources.name,
      det: stats.sourceCount > 0
        ? plural(stats.sourceCount, s.sources.on, { n: stats.sourceCount })
        : s.sources.off,
    },
    {
      key: "marge_ref",
      on: stats.hasMargeRef,
      name: s.margeRef.name,
      det: stats.hasMargeRef ? s.margeRef.on : s.margeRef.off,
    },
    {
      key: "structure",
      on: stats.hasStructure,
      name: s.structure.name,
      det: stats.hasStructure ? s.structure.on : s.structure.off,
    },
    {
      key: "argument",
      on: stats.hasArgument,
      name: s.argument.name,
      det: stats.hasArgument ? s.argument.on : s.argument.off,
    },
    {
      key: "quote",
      on: stats.hasQuote,
      name: s.quote.name,
      det: stats.hasQuote ? s.quote.on : s.quote.off,
    },
  ];

  return (
    <div className="panel">
      <p className="panel-title">{m.title}</p>
      <p className="panel-sub">{m.sub}</p>

      <div className="meta-grid">
        <div>
          <div className="lbl">{m.words}</div>
          <div className="val">{stats.words}</div>
        </div>
        <div>
          <div className="lbl">{m.reading}</div>
          <div className="val">
            {stats.readingMinutes}
            <span className="u">{m.readingUnit}</span>
          </div>
        </div>
        <div>
          <div className="lbl">{m.sources}</div>
          <div className="val">{stats.sourceCount}</div>
        </div>
        <div>
          <div className="lbl">{m.paragraphs}</div>
          <div className="val">{stats.paragraphs}</div>
        </div>
      </div>

      <ul className="signals">
        {signals.map((sig) => (
          <li key={sig.key} className={sig.on ? "on" : "off"}>
            <span className={"sym " + (sig.on ? "on" : "off")} aria-hidden="true">
              {sig.on ? "✓" : "○"}
            </span>
            <span>
              <span className="nm">{sig.name}</span>
              <span className="det">{sig.det}</span>
            </span>
          </li>
        ))}
      </ul>

      {suggestion && (
        <div className="suggestion">
          <span className="ic">{m.suggestionLabel}</span>
          {m.suggestions[suggestion]}
        </div>
      )}

      {format === "analyse" && stats.words < 800 && (
        <div
          className="suggestion"
          style={{ borderColor: "#E0D2C0", background: "#F7EFE2" }}
        >
          <span className="ic">{m.analyseLabel}</span>
          {interpolate(m.analyseUnderLimit, { n: 800 - stats.words })}
        </div>
      )}
      {format === "note" && stats.words > 280 && (
        <div
          className="suggestion"
          style={{ borderColor: "#E0D2C0", background: "#F7EFE2" }}
        >
          <span className="ic">{m.noteLabel}</span>
          {m.noteOverLimit}
        </div>
      )}
    </div>
  );
}
