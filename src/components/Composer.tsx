"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { type PostFormState, createPostAction } from "@/app/actions/posts";

/** Liste blanche des types acceptés à l'upload (cahier médias §3.2). */
const ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg";

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
        placeholder="Quoi de neuf ? (Markdown accepté)"
        className="w-full resize-y rounded border border-black/15 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/20"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="composer-media" className="text-xs text-foreground/70">
          Joindre un média{" "}
          <span className="text-foreground/55">
            (image, PDF, MP4/WebM, MP3 — 5 Mo max)
          </span>
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
            Texte alternatif{" "}
            <span className="text-foreground/55">
              (obligatoire — décrit l’image)
            </span>
          </label>
          <input
            id="composer-alt"
            name="alt"
            type="text"
            required
            maxLength={1500}
            placeholder="Décris l’image pour les personnes qui ne la voient pas"
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
