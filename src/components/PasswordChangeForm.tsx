"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type PasswordFormState,
  changePasswordAction,
} from "@/app/actions/security";
import { useActionMessage, useT } from "@/components/I18nProvider";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.forms.passwordChanging : t.forms.passwordSubmit}
    </button>
  );
}

export function PasswordChangeForm() {
  const [state, action] = useActionState<PasswordFormState, FormData>(
    changePasswordAction,
    {},
  );
  const { t } = useT();
  const msg = useActionMessage();
  const f = t.forms;

  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="current" className="text-sm font-medium">
          {f.passwordCurrent}
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="next" className="text-sm font-medium">
          {f.passwordNew}
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
        />
        <p className="text-xs text-foreground/55">{f.passwordHelp}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium">
          {f.passwordConfirm}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
        />
      </div>

      <SubmitButton />

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {msg(state.error, state.errorParams)}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {msg(state.success)}
        </p>
      )}
    </form>
  );
}
