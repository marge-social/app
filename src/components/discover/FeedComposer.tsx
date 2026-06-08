"use client";

import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/discover/icons";

type ComposerFormat = "note" | "billet" | "analyse";

const PLACEHOLDERS: Record<ComposerFormat, { title: string; body: string }> = {
  note: {
    title: "Une note brève…",
    body: "Une idée, une citation, un fragment. Quelques lignes suffisent.",
  },
  billet: {
    title: "Le titre de votre billet…",
    body: "Commencez à rédiger. Vous pourrez développer, citer des sources et répondre à d’autres textes dans l’éditeur.",
  },
  analyse: {
    title: "Le titre de votre analyse…",
    body: "Une analyse demande du temps. Posez l’argument central ici, puis structurez le texte dans l’éditeur.",
  },
};

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Composer en tête de fil — zone de saisie réelle (titre + corps), choix du
 * format, import de fichier, bouton « continuer dans l’éditeur ».
 *
 * Pré-bêta : interactif côté UI uniquement (autosize, autosave mockée, onglets),
 * **aucune** publication câblée. Les actions de sortie sont des stubs `// TODO`.
 */
export function FeedComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fmt, setFmt] = useState<ComposerFormat>("billet");
  const [savedDraft, setSavedDraft] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => autosize(titleRef.current), [title]);
  useEffect(() => autosize(bodyRef.current), [body]);

  // Autosave mockée : « Brouillon enregistré » apparaît après une courte pause.
  // La remise à « en cours » se fait dans les handlers onChange — pas de
  // setState synchrone dans l’effet (cf. react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!title.trim() && !body.trim()) return;
    const id = setTimeout(() => setSavedDraft(true), 600);
    return () => clearTimeout(id);
  }, [title, body]);

  const hasContent = title.trim().length > 0 || body.trim().length > 0;

  const onImportClick = () => fileRef.current?.click();
  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO: vraie conversion (.md/.docx/.txt…) → brouillon structuré.
    const base = file.name.replace(/\.[^.]+$/, "");
    setTitle(base);
    setBody(`Contenu importé depuis « ${file.name} ». Marge le convertira en brouillon structuré dans l’éditeur.`);
    e.target.value = "";
  };

  const onContinue = () => {
    // TODO: ouvrir l’éditeur complet (route /compose) avec le brouillon courant.
  };

  return (
    <section className="composer" aria-label="Commencer un texte">
      <div className="composer-meta">
        <span className="pip" aria-hidden />
        <span>Commencer un texte</span>
        {hasContent && (
          <span className="save">
            {savedDraft ? (
              <>
                <b>✓</b> Brouillon enregistré
              </>
            ) : (
              "Écriture en cours…"
            )}
          </span>
        )}
      </div>

      <label htmlFor="composer-title" className="sr-only">
        Titre
      </label>
      <textarea
        id="composer-title"
        ref={titleRef}
        className="composer-title"
        rows={1}
        placeholder={PLACEHOLDERS[fmt].title}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSavedDraft(false);
        }}
      />

      <label htmlFor="composer-body" className="sr-only">
        Corps du texte
      </label>
      <textarea
        id="composer-body"
        ref={bodyRef}
        className="composer-body"
        rows={2}
        placeholder={PLACEHOLDERS[fmt].body}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSavedDraft(false);
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,.docx,.odt,.html"
        hidden
        onChange={onFileChosen}
      />

      <div className="composer-bar">
        <div className="composer-fmt-pick" role="tablist" aria-label="Format">
          {(["note", "billet", "analyse"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={fmt === f}
              onClick={() => setFmt(f)}
            >
              {f === "note" ? "Note brève" : f === "billet" ? "Billet" : "Analyse"}
            </button>
          ))}
        </div>
        <div className="composer-actions">
          {!hasContent && <span className="composer-hint">ou&nbsp;</span>}
          <button
            type="button"
            className="composer-action"
            onClick={onImportClick}
            title="Importer un fichier (.md, .docx, .txt…)"
          >
            {Icons.upload}
            Importer
          </button>
          <button
            type="button"
            className="composer-action primary"
            disabled={!hasContent}
            onClick={onContinue}
          >
            Continuer dans l’éditeur
            {Icons.arrowRight}
          </button>
        </div>
      </div>
    </section>
  );
}
