"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  type ArticleFormState,
  saveArticleAction,
} from "@/app/actions/articles";
import { useActionMessage, useT } from "@/components/I18nProvider";
import {
  type EditorFormat,
  type Source,
  computeStats,
  htmlToMarkdown,
  markdownToHtml,
  pickSuggestion,
  serializeSources,
} from "@/lib/editor/serialize";
import { CoverImage } from "./CoverImage";
import {
  FloatingToolbar,
  applyCommand,
  insertFootnoteMarker,
  useSelectionToolbar,
} from "./FloatingToolbar";
import { FormatSelector } from "./FormatSelector";
import { MirrorPanel } from "./MirrorPanel";
import { SourceModal } from "./SourceModal";
import { SourcesRail } from "./SourcesRail";
import { TransparencyModal } from "./TransparencyModal";

export interface EditorArticle {
  id: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  status: "draft" | "published";
}

/** Auto-dimensionne un <textarea> sur son contenu. */
function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

/**
 * Surface d'écriture de Marge — recrée le prototype « edition-article.html »
 * (corps WYSIWYG sérif + barre flottante, image d'illustration, panneau miroir,
 * rail des sources, sélecteur de format, modales source/transparence) tout en
 * réémettant le contrat FormData attendu par `saveArticleAction` (le stockage
 * reste du Markdown).
 */
export function ArticleEditor({
  article,
  inReplyTo,
  replyToHref,
}: {
  article?: EditorArticle;
  inReplyTo?: string;
  replyToHref?: string;
}) {
  const { t, plural, interpolate } = useT();
  const ed = t.editor;
  const msg = useActionMessage();
  const [state, action, isPending] = useActionState<ArticleFormState, FormData>(
    saveArticleAction,
    {},
  );

  const isNew = !article?.id;
  const [format, setFormat] = useState<EditorFormat>("billet");
  const [title, setTitle] = useState(article?.title ?? "");
  const [chapo, setChapo] = useState(article?.summary ?? "");
  const [sources, setSources] = useState<Source[]>([]);
  const [bodyTick, setBodyTick] = useState(0);
  const [sourceModal, setSourceModal] = useState<{
    open: boolean;
    passage: string;
  }>({ open: false, passage: "" });
  const [transparencyOpen, setTransparencyOpen] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);
  const [tb, tbActive] = useSelectionToolbar(bodyRef);

  // Peuplement initial du corps depuis le Markdown stocké (édition d'un
  // brouillon / article existant). Une seule fois par article.
  useEffect(() => {
    if (bodyRef.current && article?.contentMarkdown) {
      bodyRef.current.innerHTML = markdownToHtml(article.contentMarkdown);
      setBodyTick((x) => x + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  // Les stats lisent le DOM live du corps : recalculées dans un effet (jamais
  // pendant le rendu) à chaque frappe (bodyTick) / changement de méta.
  const hasMargeSource = sources.some((s) => s.kind === "marge");
  const [stats, setStats] = useState(() =>
    computeStats(null, title, chapo, sources.length, hasMargeSource),
  );
  useEffect(() => {
    setStats(
      computeStats(bodyRef.current, title, chapo, sources.length, hasMargeSource),
    );
  }, [title, chapo, sources.length, hasMargeSource, bodyTick]);
  const suggestion = pickSuggestion(stats);

  const onBodyInput = () => setBodyTick((x) => x + 1);

  const openSourceModalFromSelection = () => {
    const sel = window.getSelection();
    const passage =
      sel && sel.toString().trim().length > 4
        ? sel.toString().trim().slice(0, 240)
        : "";
    setSourceModal({ open: true, passage });
  };

  const addSource = (src: Source) => {
    setSources((arr) => {
      const next = [...arr, src];
      setTimeout(() => insertFootnoteMarker(bodyRef, next.length), 0);
      setBodyTick((x) => x + 1);
      return next;
    });
    setSourceModal({ open: false, passage: "" });
  };

  const removeSource = (id: string) => {
    setSources((arr) => arr.filter((s) => s.id !== id));
    setTimeout(() => {
      const body = bodyRef.current;
      if (!body) return;
      body
        .querySelectorAll("sup.footnote")
        .forEach((sup, i) => (sup.textContent = String(i + 1)));
      setBodyTick((x) => x + 1);
    }, 0);
  };

  // Sérialise le corps (+ bloc Sources) dans le champ caché juste avant l'envoi.
  const syncContent = () => {
    const md = htmlToMarkdown(bodyRef.current?.innerHTML ?? "");
    const block = serializeSources(sources, ed.sourcesPanel.title);
    if (contentRef.current) contentRef.current.value = (md + block).trim();
  };

  return (
    <div className="article-editor">
      <form action={action} className="ae-shell">
        {article?.id && <input type="hidden" name="id" value={article.id} />}
        {inReplyTo && <input type="hidden" name="inReplyTo" value={inReplyTo} />}
        <input type="hidden" name="content" ref={contentRef} />

        {/* COLONNE ÉDITEUR */}
        <main className="editor-col">
          <div className="editor-wrap">
            <div className="editor-topbar">
              <FormatSelector value={format} onChange={setFormat} />
            </div>

            {inReplyTo && (
              <p
                className="suggestion"
                role="note"
                style={{ marginBottom: 24, marginTop: 0 }}
              >
                {ed.replyingTo}{" "}
                {replyToHref ? (
                  <a href={replyToHref} className="underline">
                    {ed.replyingToLink}
                  </a>
                ) : (
                  ed.replyingToLink
                )}
                {ed.replyingToSuffix}
              </p>
            )}

            {state.error && (
              <p
                role="alert"
                className="suggestion"
                style={{
                  marginBottom: 24,
                  marginTop: 0,
                  borderColor: "#d98b6f",
                  background: "#f7e7e0",
                  color: "var(--brick)",
                }}
              >
                {msg(state.error)}
              </p>
            )}

            {isNew && <CoverImage />}

            <textarea
              className="ed-title"
              name="title"
              rows={1}
              required
              placeholder={ed.titlePlaceholder}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                autosize(e.target);
              }}
              ref={autosize}
            />
            <textarea
              className="ed-chapo"
              name="summary"
              rows={1}
              placeholder={ed.chapoPlaceholder}
              value={chapo}
              onChange={(e) => {
                setChapo(e.target.value);
                autosize(e.target);
              }}
              ref={autosize}
            />
            <div
              ref={bodyRef}
              className="ed-body"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={ed.bodyPlaceholder}
              onInput={onBodyInput}
            />

            {/* BARRE DE PUBLICATION (en flux) */}
            <div className="publish-bar">
              <div className="left">
                <button
                  type="button"
                  className="footer-link"
                  onClick={() => setTransparencyOpen(true)}
                >
                  <span className="glyph">↗</span>
                  {ed.publishBar.transparency}
                </button>
                <span className="footer-aux">
                  ·{" "}
                  {plural(stats.words, ed.publishBar.words, { n: stats.words })}{" "}
                  · {interpolate(ed.publishBar.reading, { n: stats.readingMinutes })}
                </span>
              </div>
              <div className="publish-actions">
                <button
                  type="submit"
                  name="intent"
                  value="draft"
                  disabled={isPending}
                  className="btn btn-ghost"
                  onClick={syncContent}
                >
                  {ed.saveDraft}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={isPending}
                  className="btn btn-primary"
                  onClick={syncContent}
                >
                  {isPending ? ed.pending : ed.publish}
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* RAIL DROIT */}
        <aside className="rail">
          <MirrorPanel stats={stats} format={format} suggestion={suggestion} />
          <SourcesRail
            sources={sources}
            onRemove={removeSource}
            onAdd={() => setSourceModal({ open: true, passage: "" })}
          />
        </aside>
      </form>

      {/* BARRE FLOTTANTE (hors form) */}
      <FloatingToolbar
        visible={tb.visible}
        position={{ x: tb.x, y: tb.y }}
        active={tbActive}
        onCommand={(c) => applyCommand(c, bodyRef, ed.toolbar.linkPrompt)}
        onAddSource={openSourceModalFromSelection}
      />

      {/* MODALES (hors form) */}
      {sourceModal.open && (
        <SourceModal
          initialPassage={sourceModal.passage}
          onClose={() => setSourceModal({ open: false, passage: "" })}
          onSave={addSource}
        />
      )}
      {transparencyOpen && (
        <TransparencyModal
          stats={stats}
          format={format}
          onClose={() => setTransparencyOpen(false)}
        />
      )}
    </div>
  );
}
