"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { type PostFormState, createPostAction } from "@/app/actions/posts";
import { useActionMessage, useT } from "@/components/I18nProvider";

/** Liste blanche des types acceptés à l'upload (cahier médias §3.2). */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.composer.publishing : t.composer.publish}
    </button>
  );
}

/**
 * Bloc de rédaction en tête de home (§Lot 3). Un champ texte (Markdown) + une
 * pièce jointe optionnelle (cahier médias). Quand une image est choisie, le
 * champ de texte alternatif apparaît **directement** (sans étape, §4.1) et
 * devient obligatoire. Le formulaire est réinitialisé après succès.
 */
export function Composer() {
  const [state, action] = useActionState<PostFormState, FormData>(
    createPostAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useT();
  const msg = useActionMessage();
  const c = t.composer;
  // null = aucun fichier ; true/false = image ou non (pilote l'affichage du alt).
  const [isImage, setIsImage] = useState<boolean | null>(null);

  // Réinitialise le DOM du formulaire après succès (pas d'erreur retournée).
  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  // Réinitialise l'état local du média au même moment, via l'ajustement d'état
  // pendant le rendu (recommandé par React plutôt qu'un setState en effet).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state && !state.error) setIsImage(null);
  }

  return (
    <form
      ref={formRef}
      action={action}
      aria-label={c.ariaLabel}
      className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <label htmlFor="composer-body" className="sr-only">
        {c.bodyLabel}
      </label>
      <textarea
        id="composer-body"
        name="body"
        rows={3}
        placeholder={c.placeholder}
        className="w-full resize-y rounded border border-black/15 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="composer-media" className="text-xs text-foreground/70">
          {c.attachMedia}{" "}
          <span className="text-foreground/55">{c.attachMediaHint}</span>
        </label>
        <input
          id="composer-media"
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
          <label htmlFor="composer-alt" className="text-xs text-foreground/70">
            {c.altLabel}{" "}
            <span className="text-foreground/55">{c.altHint}</span>
          </label>
          <input
            id="composer-alt"
            name="alt"
            type="text"
            required
            maxLength={1500}
            placeholder={c.altPlaceholder}
            className="w-full rounded border border-black/15 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <a
          href="https://www.markdownguide.org/basic-syntax/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/55 underline"
        >
          {c.markdownHelp}
        </a>
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {msg(state.error, state.errorParams)}
        </p>
      )}
    </form>
  );
}
