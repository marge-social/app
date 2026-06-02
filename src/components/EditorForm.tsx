"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { marked } from "marked";
import {
  type ArticleFormState,
  saveArticleAction,
} from "@/app/actions/articles";

export interface EditorArticle {
  id: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  status: "draft" | "published";
}

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";

function SubmitButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        className="rounded border border-black/20 px-4 py-2 font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/10"
      >
        Enregistrer le brouillon
      </button>
      <button
        type="submit"
        name="intent"
        value="publish"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Patiente…" : "Publier"}
      </button>
    </div>
  );
}

export function EditorForm({ article }: { article?: EditorArticle }) {
  const [state, action] = useActionState<ArticleFormState, FormData>(
    saveArticleAction,
    {},
  );
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [content, setContent] = useState(article?.contentMarkdown ?? "");

  // Aperçu client (contenu de l'auteur lui-même ; la sanitisation a lieu côté
  // serveur à l'enregistrement).
  const previewHtml = useMemo(
    () => marked.parse(content, { async: false }) as string,
    [content],
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {article?.id && <input type="hidden" name="id" value={article.id} />}

      {state.error && (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Titre
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
          Résumé / chapô{" "}
          <span className="font-normal text-foreground/60">(optionnel)</span>
        </label>
        <input
          id="summary"
          name="summary"
          defaultValue={article?.summary ?? ""}
          className={fieldClass}
          aria-describedby="summary-help"
        />
        <p id="summary-help" className="text-xs text-foreground/60">
          Sert d’aperçu et de résumé fédéré. À défaut, dérivé du début du texte.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="tablist"
          aria-label="Mode d’édition"
          className="flex gap-1 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            onClick={() => setTab("write")}
            className={`rounded px-3 py-1 ${tab === "write" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
          >
            Écrire
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            onClick={() => setTab("preview")}
            className={`rounded px-3 py-1 ${tab === "preview" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
          >
            Aperçu
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
            placeholder="Écris ton texte en Markdown…"
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

      <SubmitButtons />
    </form>
  );
}
