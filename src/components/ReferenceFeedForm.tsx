"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type FeedFormState,
  referenceFeedAction,
} from "@/app/actions/feeds";
import { useActionMessage, useT } from "@/components/I18nProvider";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.forms.feedReading : t.forms.feedReference}
    </button>
  );
}

export function ReferenceFeedForm() {
  const [state, action] = useActionState<FeedFormState, FormData>(
    referenceFeedAction,
    {},
  );
  const { t } = useT();
  const msg = useActionMessage();
  const f = t.forms;
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="url"
          type="url"
          required
          placeholder={f.feedPlaceholder}
          aria-label={f.feedAriaLabel}
          autoCapitalize="none"
          className="flex-1 rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40"
        />
        <SubmitButton />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {msg(state.error)}
        </p>
      )}
      <p className="text-xs text-foreground/60">{f.feedHelp}</p>
    </form>
  );
}
