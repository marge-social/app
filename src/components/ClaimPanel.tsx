"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type OwnershipState,
  feedOwnershipAction,
} from "@/app/actions/claims";

function Pending({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : children}</>;
}

export function ClaimPanel({
  feedId,
  ownershipStatus,
}: {
  feedId: string;
  ownershipStatus: "orphan" | "claimed";
}) {
  const [state, action] = useActionState<OwnershipState, FormData>(
    feedOwnershipAction,
    {},
  );

  // Phase 2 : un jeton a été généré, on guide l'insertion + vérification.
  if (state.token && state.claimId) {
    return (
      <div className="flex flex-col gap-3 rounded border border-black/15 p-4 dark:border-white/20">
        <h3 className="font-semibold">
          {state.type === "opt_out"
            ? "Confirmer le retrait de ce flux"
            : "Prouver que ce flux est le vôtre"}
        </h3>
        <p className="text-sm text-foreground/75">
          Insérez ce jeton dans votre flux (par ex. dans le titre ou la
          description d’un billet, ou une balise du flux), republiez, puis
          cliquez sur Vérifier. Marge récupère le flux et confirme votre
          contrôle.
        </p>
        <code className="select-all rounded bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
          {state.token}
        </code>
        {state.error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {state.error}
          </p>
        )}
        <form action={action} className="flex gap-2">
          <input type="hidden" name="feedId" value={feedId} />
          <input type="hidden" name="claimId" value={state.claimId} />
          <input type="hidden" name="intent" value="verify" />
          <button
            type="submit"
            className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <Pending>Vérifier maintenant</Pending>
          </button>
        </form>
      </div>
    );
  }

  // Phase 1 : choix réclamer / opt-out.
  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 bg-black/[0.03] p-4 dark:border-white/15 dark:bg-white/[0.03]">
      <h3 className="font-semibold">C’est votre blog ?</h3>
      <p className="text-sm text-foreground/75">
        Ce flux est référencé{" "}
        {ownershipStatus === "orphan"
          ? "sans propriétaire"
          : "et déjà réclamé"}
        . Vous pouvez prouver que vous le contrôlez pour le réclamer, ou en
        demander le retrait définitif (opt-out).
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="feedId" value={feedId} />
        {ownershipStatus === "orphan" && (
          <button
            type="submit"
            name="intent"
            value="claim-request"
            className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <Pending>Réclamer ce flux</Pending>
          </button>
        )}
        <button
          type="submit"
          name="intent"
          value="optout-request"
          className="rounded border border-red-500/40 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
        >
          <Pending>Demander le retrait (opt-out)</Pending>
        </button>
      </form>
    </div>
  );
}
