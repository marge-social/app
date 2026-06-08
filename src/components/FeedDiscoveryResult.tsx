"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type FeedFormState,
  referenceFeedAction,
} from "@/app/actions/feeds";
import { useActionMessage, useT } from "@/components/I18nProvider";

export interface FeedDiscoveryPreview {
  feedUrl: string;
  title: string;
  description: string;
  itemCount: number;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "…" : t.search.addThisFeed}
    </button>
  );
}

/**
 * Résultat « flux RSS » auto-découvert à partir d'une URL : titre, description
 * + bouton d'ajout pré-rempli (référence + abonnement, puis redirection vers la
 * page du flux). Affiché dans la section Flux.
 */
export function FeedDiscoveryResult({
  feed,
}: {
  feed: FeedDiscoveryPreview;
}) {
  const [state, action] = useActionState<FeedFormState, FormData>(
    referenceFeedAction,
    {},
  );
  const msg = useActionMessage();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{feed.title || feed.feedUrl}</span>
          <p className="text-xs text-foreground/60">{feed.feedUrl}</p>
          {feed.description && (
            <p className="text-sm text-foreground/70">{feed.description}</p>
          )}
        </div>
        <form action={action}>
          <input type="hidden" name="url" value={feed.feedUrl} />
          <SubmitButton />
        </form>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {msg(state.error)}
        </p>
      )}
    </div>
  );
}
