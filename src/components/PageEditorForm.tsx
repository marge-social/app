"use client";

import { marked } from "marked";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { type PageFormState, savePageAction } from "@/app/actions/pages";

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";
const tabClass = (active: boolean) =>
  `rounded px-3 py-1 text-sm ${
    active
      ? "bg-foreground text-background"
      : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
  }`;

/** Slugification côté client pour l'aperçu d'URL (le serveur refait foi). */
function clientSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Enregistrement…" : isNew ? "Créer la page" : "Enregistrer"}
    </button>
  );
}

export interface PageEditorData {
  slug: string;
  title: string;
  contentMarkdown: string;
}

/** Éditeur Markdown d'une page de contenu (admin) — création ou édition. */
export function PageEditorForm({
  page,
  isNew = false,
}: {
  page?: PageEditorData;
  isNew?: boolean;
}) {
  const [state, action] = useActionState<PageFormState, FormData>(
    savePageAction,
    {},
  );
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState(page?.title ?? "");
  const [content, setContent] = useState(page?.contentMarkdown ?? "");
  // En création, le slug se déduit du titre tant qu'il n'a pas été édité à la main.
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  const effectiveSlug = isNew && !slugTouched ? clientSlug(title) : slug;
  const previewHtml = useMemo(
    () => marked.parse(content, { async: false }) as string,
    [content],
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300"
        >
          Page enregistrée.
        </p>
      )}

      <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Titre
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
      </div>

      {isNew ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="slug" className="text-sm font-medium">
            Slug (URL)
          </label>
          <input
            id="slug"
            name="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={`${fieldClass} font-mono text-sm`}
          />
          <p className="text-xs text-black/55 dark:text-white/55">
            URL publique : <span className="font-mono">/{effectiveSlug || "…"}</span>{" "}
            — fixé à la création, non modifiable ensuite.
          </p>
        </div>
      ) : (
        <>
          <input type="hidden" name="slug" value={page?.slug ?? ""} />
          <p className="text-xs text-black/55 dark:text-white/55">
            URL publique :{" "}
            <a href={`/${page?.slug}`} className="font-mono underline">
              /{page?.slug}
            </a>
          </p>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={tabClass(tab === "write")}
        >
          Rédiger
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={tabClass(tab === "preview")}
        >
          Aperçu
        </button>
      </div>

      {/* Le textarea reste monté (même caché) pour rester dans le FormData. */}
      <textarea
        id="content"
        name="content"
        required
        rows={20}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Rédige le contenu en Markdown…"
        className={`${fieldClass} font-mono text-sm ${tab === "preview" ? "hidden" : ""}`}
      />
      {tab === "preview" && (
        <article
          className="prose-marge min-h-[20rem] rounded border border-black/10 px-4 py-3 dark:border-white/15"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}

      <SaveButton isNew={isNew} />
    </form>
  );
}
