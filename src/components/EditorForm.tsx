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

/** Liste blanche des types acceptés à l'upload (cahier médias §3.2). */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg";

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
          En réponse à{" "}
          {replyToHref ? (
            <a href={replyToHref} className="underline">
              un contenu publié
            </a>
          ) : (
            "un contenu publié"
          )}
          . Votre billet apparaîtra dans le fil et sera rattaché à ce contenu.
        </p>
      )}

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

      {isNew && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="media" className="text-sm font-medium">
              Pièce jointe{" "}
              <span className="font-normal text-foreground/60">
                (optionnel — image, PDF, MP4/WebM, MP3, 5 Mo max)
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
                Texte alternatif{" "}
                <span className="font-normal text-foreground/60">
                  (obligatoire — décrit l’image)
                </span>
              </label>
              <input
                id="alt"
                name="alt"
                type="text"
                required
                maxLength={1500}
                placeholder="Décris l’image pour les personnes qui ne la voient pas"
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
