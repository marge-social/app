"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { type PostFormState, createPostAction } from "@/app/actions/posts";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Publication…" : "Publier"}
    </button>
  );
}

/**
 * Bloc de rédaction en tête de home (§Lot 3). Un seul champ : le corps,
 * sensible au Markdown. Publie une Note fédérée. Le champ est réinitialisé
 * après une publication réussie.
 */
export function Composer() {
  const [state, action] = useActionState<PostFormState, FormData>(
    createPostAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Réinitialise après succès (pas d'erreur retournée par l'action).
  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      aria-label="Écrire un message"
      className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <label htmlFor="composer-body" className="sr-only">
        Votre message (Markdown accepté)
      </label>
      <textarea
        id="composer-body"
        name="body"
        rows={3}
        required
        placeholder="Quoi de neuf ? (Markdown accepté)"
        className="w-full resize-y rounded border border-black/15 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
      />
      <div className="flex items-center justify-between gap-3">
        <a
          href="https://www.markdownguide.org/basic-syntax/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/55 underline"
        >
          Aide Markdown
        </a>
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
