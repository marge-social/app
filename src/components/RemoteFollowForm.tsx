"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type RemoteFollowState,
  followRemoteAction,
} from "@/app/actions/follows";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "…" : "Suivre"}
    </button>
  );
}

export function RemoteFollowForm() {
  const [state, action] = useActionState<RemoteFollowState, FormData>(
    followRemoteAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="handle"
          placeholder="@compte@instance.social"
          aria-label="Handle d’un compte du Fediverse"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40"
        />
        <SubmitButton />
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
    </form>
  );
}
