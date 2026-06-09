"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import type { Source, SourceKind } from "@/lib/editor/serialize";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return "s_" + crypto.randomUUID().slice(0, 8);
  }
  return "s_" + Math.random().toString(36).slice(2, 8);
}

/** Modale d'ajout de source (onglets Lien / Ouvrage / Article / Texte sur Marge). */
export function SourceModal({
  initialPassage,
  onClose,
  onSave,
}: {
  initialPassage: string;
  onClose: () => void;
  onSave: (s: Source) => void;
}) {
  const { t } = useT();
  const sm = t.editor.sourceModal;
  const [kind, setKind] = useState<SourceKind>("url");
  const [fields, setFields] = useState({
    url: "",
    title: "",
    author: "",
    year: "",
    isbn: "",
    doi: "",
    venue: "",
    margeRef: "",
  });
  const update = (k: keyof typeof fields, v: string) =>
    setFields((f) => ({ ...f, [k]: v }));

  const canSave =
    (kind === "url" && (fields.url.trim() || fields.title.trim())) ||
    (kind === "book" && fields.title.trim()) ||
    (kind === "article" && fields.title.trim()) ||
    (kind === "marge" && fields.margeRef.trim());

  const save = () => {
    if (!canSave) return;
    onSave({
      id: newId(),
      kind,
      title: kind === "marge" ? fields.margeRef : fields.title,
      url: fields.url,
      author: fields.author,
      year: fields.year,
      isbn: fields.isbn,
      doi: fields.doi,
      venue: fields.venue,
    });
  };

  const tabs: [SourceKind, string][] = [
    ["url", sm.tabs.url],
    ["book", sm.tabs.book],
    ["article", sm.tabs.article],
    ["marge", sm.tabs.marge],
  ];

  return (
    <div className="ae-modal-scrim" onClick={onClose}>
      <div className="ae-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>{sm.title}</h3>
          <button className="x" onClick={onClose} aria-label={sm.close}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <label>{sm.attachedPassage}</label>
            <div className="passage-box">
              {initialPassage ? (
                <span className="quoted">{initialPassage}</span>
              ) : (
                <span className="none">{sm.noPassage}</span>
              )}
            </div>
          </div>

          <div className="source-kind-tabs" role="tablist">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === "url" && (
            <>
              <div className="field-row">
                <label>{sm.url}</label>
                <input
                  type="url"
                  value={fields.url}
                  onChange={(e) => update("url", e.target.value)}
                  placeholder={sm.urlPlaceholder}
                  autoFocus
                />
              </div>
              <div className="field-row">
                <label>{sm.pageTitle}</label>
                <input
                  type="text"
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder={sm.pageTitlePlaceholder}
                />
              </div>
              <div className="field-grid">
                <div className="field-row">
                  <label>{sm.authorOrMedia}</label>
                  <input
                    type="text"
                    value={fields.author}
                    onChange={(e) => update("author", e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <label>{sm.year}</label>
                  <input
                    type="text"
                    value={fields.year}
                    onChange={(e) => update("year", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {kind === "book" && (
            <>
              <div className="field-row">
                <label>{sm.bookTitle}</label>
                <input
                  type="text"
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field-grid">
                <div className="field-row">
                  <label>{sm.author}</label>
                  <input
                    type="text"
                    value={fields.author}
                    onChange={(e) => update("author", e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <label>{sm.year}</label>
                  <input
                    type="text"
                    value={fields.year}
                    onChange={(e) => update("year", e.target.value)}
                  />
                </div>
              </div>
              <div className="field-row">
                <label>{sm.isbn}</label>
                <input
                  type="text"
                  value={fields.isbn}
                  onChange={(e) => update("isbn", e.target.value)}
                  placeholder={sm.isbnPlaceholder}
                />
                <div className="field-hint">{sm.isbnHint}</div>
              </div>
            </>
          )}

          {kind === "article" && (
            <>
              <div className="field-row">
                <label>{sm.articleTitle}</label>
                <input
                  type="text"
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field-row">
                <label>{sm.authors}</label>
                <input
                  type="text"
                  value={fields.author}
                  onChange={(e) => update("author", e.target.value)}
                />
              </div>
              <div className="field-grid">
                <div className="field-row">
                  <label>{sm.venue}</label>
                  <input
                    type="text"
                    value={fields.venue}
                    onChange={(e) => update("venue", e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <label>{sm.year}</label>
                  <input
                    type="text"
                    value={fields.year}
                    onChange={(e) => update("year", e.target.value)}
                  />
                </div>
              </div>
              <div className="field-row">
                <label>{sm.doi}</label>
                <input
                  type="text"
                  value={fields.doi}
                  onChange={(e) => update("doi", e.target.value)}
                  placeholder={sm.doiPlaceholder}
                />
              </div>
            </>
          )}

          {kind === "marge" && (
            <div className="field-row">
              <label>{sm.margeText}</label>
              <input
                type="text"
                value={fields.margeRef}
                onChange={(e) => update("margeRef", e.target.value)}
                placeholder={sm.margePlaceholder}
                autoFocus
              />
              <div className="field-hint">{sm.margeHint}</div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {sm.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSave}
            style={{
              opacity: canSave ? 1 : 0.45,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            onClick={save}
          >
            {sm.add}
          </button>
        </div>
      </div>
    </div>
  );
}
