"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type FeedFormState,
  referenceFeedAction,
} from "@/app/actions/feeds";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Lecture…" : "Référencer"}
    </button>
  );
}

export function ReferenceFeedForm() {
  const [state, action] = useActionState<FeedFormState, FormData>(
    referenceFeedAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="url"
          type="url"
          required
          placeholder="https://un-blog.example/ ou .../feed.xml"
          aria-label="URL d’un blog ou d’un flux RSS"
          autoCapitalize="none"
          className="flex-1 rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40"
        />
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <p className="text-xs text-foreground/60">
        Colle l’adresse d’un blog (le flux est auto-découvert) ou directement
        celle d’un flux RSS/Atom. Le flux devient suivable par tout le monde.
      </p>
    </form>
  );
}
