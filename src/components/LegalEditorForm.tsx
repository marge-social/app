"use client";

import { marked } from "marked";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { type LegalFormState, saveLegalPageAction } from "@/app/actions/legal";

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";
const tabClass = (active: boolean) =>
  `rounded px-3 py-1 text-sm ${
    active
      ? "bg-foreground text-background"
      : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
  }`;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}

/** Éditeur Markdown de la page « mentions légales » (admin). */
export function LegalEditorForm({
  contentMarkdown,
}: {
  contentMarkdown: string;
}) {
  const [state, action] = useActionState<LegalFormState, FormData>(
    saveLegalPageAction,
    {},
  );
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [content, setContent] = useState(contentMarkdown);

  // Aperçu non sanitisé (le serveur sanitise à l'enregistrement).
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
          Mentions légales enregistrées.
        </p>
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
        placeholder="Rédige les mentions légales en Markdown…"
        className={`${fieldClass} font-mono text-sm ${tab === "preview" ? "hidden" : ""}`}
      />
      {tab === "preview" && (
        <article
          className="prose-marge min-h-[20rem] rounded border border-black/10 px-4 py-3 dark:border-white/15"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}

      <SaveButton />
    </form>
  );
}
