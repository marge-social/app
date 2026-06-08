"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type RemoteFollowState,
  followRemoteAction,
} from "@/app/actions/follows";
import type { RemoteActorPreview } from "@/federation/follow";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "…" : "Suivre"}
    </button>
  );
}

/**
 * Résultat « compte du Fediverse » résolu en direct (WebFinger) : avatar, nom,
 * handle, bio + bouton Suivre pré-rempli. Affiché dans la section Comptes.
 */
export function RemoteProfileResult({ actor }: { actor: RemoteActorPreview }) {
  const [state, action] = useActionState<RemoteFollowState, FormData>(
    followRemoteAction,
    {},
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start gap-3">
        {actor.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={actor.iconUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-foreground/10" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <a
            href={actor.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:underline"
          >
            <span className="font-medium">{actor.name}</span>{" "}
            <span className="font-mono text-xs text-foreground/60">
              {actor.handle}
            </span>
          </a>
          {actor.summary && (
            <p className="text-sm text-foreground/70">{actor.summary}</p>
          )}
        </div>
        <form action={action}>
          <input type="hidden" name="handle" value={actor.handle} />
          <SubmitButton />
        </form>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {state.success}
        </p>
      )}
    </div>
  );
}
