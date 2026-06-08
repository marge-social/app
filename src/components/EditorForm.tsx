"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { marked } from "marked";
import {
  type ArticleFormState,
  saveArticleAction,
} from "@/app/actions/articles";
import { useActionMessage, useT } from "@/components/I18nProvider";

export interface EditorArticle {
  id: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  status: "draft" | "published";
}

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";

/** Liste blanche des types acceptés à l'upload (cahier médias §3.2). */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg";

function SubmitButtons() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        className="rounded border border-black/20 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
      >
        {t.editor.saveDraft}
      </button>
      <button
        type="submit"
        name="intent"
        value="publish"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t.editor.pending : t.editor.publish}
      </button>
    </div>
  );
}

export function EditorForm({
  article,
  inReplyTo,
  replyToHref,
}: {
  article?: EditorArticle;
  /** IRI du contenu d'origine pour une réponse-billet (§2.3). */
  inReplyTo?: string;
  /** Lien humain vers ce contenu, pour le bandeau de contexte. */
  replyToHref?: string;
}) {
  const [state, action] = useActionState<ArticleFormState, FormData>(
    saveArticleAction,
    {},
  );
  const { t } = useT();
  const msg = useActionMessage();
  const ed = t.editor;
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [content, setContent] = useState(article?.contentMarkdown ?? "");
  // Pièce jointe : proposée à la création seulement. null = aucun fichier.
  const [isImage, setIsImage] = useState<boolean | null>(null);
  const isNew = !article?.id;

  // Aperçu client (contenu de l'auteur lui-même ; la sanitisation a lieu côté
  // serveur à l'enregistrement).
  const previewHtml = useMemo(
    () => marked.parse(content, { async: false }) as string,
    [content],
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {article?.id && <input type="hidden" name="id" value={article.id} />}
      {inReplyTo && <input type="hidden" name="inReplyTo" value={inReplyTo} />}

      {inReplyTo && (
        <p className="rounded border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-foreground/70 dark:border-white/15 dark:bg-white/[0.05]">
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
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {msg(state.error)}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          {ed.title}
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={article?.title ?? ""}
          className={`${fieldClass} text-lg`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="summary" className="text-sm font-medium">
          {ed.summary}{" "}
          <span className="font-normal text-foreground/60">{ed.optional}</span>
        </label>
        <input
          id="summary"
          name="summary"
          defaultValue={article?.summary ?? ""}
          className={fieldClass}
          aria-describedby="summary-help"
        />
        <p id="summary-help" className="text-xs text-foreground/60">
          {ed.summaryHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="tablist"
          aria-label={ed.editMode}
          className="flex gap-1 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            onClick={() => setTab("write")}
            className={`rounded px-3 py-1 ${tab === "write" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
          >
            {ed.write}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            onClick={() => setTab("preview")}
            className={`rounded px-3 py-1 ${tab === "preview" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
          >
            {ed.preview}
          </button>
        </div>

        {tab === "write" ? (
          <textarea
            id="content"
            name="content"
            required
            rows={18}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={ed.contentPlaceholder}
            className={`${fieldClass} font-mono text-sm`}
          />
        ) : (
          <>
            {/* Le contenu reste soumis même en mode aperçu. */}
            <textarea name="content" value={content} readOnly hidden />
            <article
              className="prose-marge min-h-[18rem] rounded border border-black/10 px-4 py-3 dark:border-white/15"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </>
        )}
      </div>

      {isNew && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="media" className="text-sm font-medium">
              {ed.attachment}{" "}
              <span className="font-normal text-foreground/60">
                {ed.attachmentHint}
              </span>
            </label>
            <input
              id="media"
              name="media"
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setIsImage(f ? f.type.startsWith("image/") : null);
              }}
              className="text-sm"
            />
          </div>
          {isImage && (
            <div className="flex flex-col gap-1">
              <label htmlFor="alt" className="text-sm font-medium">
                {ed.altLabel}{" "}
                <span className="font-normal text-foreground/60">
                  {ed.altHint}
                </span>
              </label>
              <input
                id="alt"
                name="alt"
                type="text"
                required
                maxLength={1500}
                placeholder={ed.altPlaceholder}
                className={fieldClass}
              />
            </div>
          )}
        </div>
      )}

      <SubmitButtons />
    </form>
  );
}
