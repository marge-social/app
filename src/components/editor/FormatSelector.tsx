"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import type { EditorFormat } from "@/lib/editor/serialize";

const ORDER: EditorFormat[] = ["note", "billet", "analyse"];

/**
 * Pastille de sélection de format (Note brève / Billet / Analyse), relocalisée
 * en tête de la colonne éditeur. Advisory : l'article fédère toujours comme
 * `Article` — le choix n'alimente que les nudges du panneau miroir.
 */
export function FormatSelector({
  value,
  onChange,
}: {
  value: EditorFormat;
  onChange: (v: EditorFormat) => void;
}) {
  const { t } = useT();
  const f = t.editor.formats;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", close), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="format-wrap">
      <button
        type="button"
        className="format-pill"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="badge-dot" aria-hidden="true" />
        {f[value].name}
        <span className="chev">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div
          className="format-menu"
          role="listbox"
          aria-label={t.editor.formatSelectorLabel}
        >
          {ORDER.map((key) => (
            <div
              key={key}
              className="opt"
              role="option"
              aria-selected={key === value}
              data-current={key === value}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            >
              <div className="name">
                {f[key].name}
                {key === value && <span className="check">●</span>}
              </div>
              <div className="ax">{f[key].cap}</div>
              <div className="desc">{f[key].blurb}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
