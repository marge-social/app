"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AuthState,
  loginAction,
  signupAction,
} from "@/app/actions/auth";
import { useActionMessage, useT } from "@/components/I18nProvider";

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.auth.pending : label}
    </button>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
    >
      {message}
    </p>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  const { t } = useT();
  const msg = useActionMessage();
  const a = t.auth;
  const p = t.portal;

  // Inscription en deux temps (cf. ADR 0006) : email + mot de passe, puis email
  // d'activation. Le handle et le profil se choisissent à l'onboarding.
  if (state.ok) {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded border border-black/15 bg-black/[0.03] p-4 dark:border-white/15 dark:bg-white/[0.04]"
      >
        <p className="font-medium">{p.emailSentHeading}</p>
        <p className="text-sm text-foreground/70">{p.emailSentBody}</p>
        <p className="text-xs text-foreground/60">{p.emailSentHint}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBanner message={msg(state.error)} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {a.email}
        </label>
        <input id="email" name="email" type="email" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {a.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className={fieldClass}
          aria-describedby="password-help"
        />
        <p id="password-help" className="text-xs text-foreground/60">
          {a.passwordHelp}
        </p>
      </div>
      <SubmitButton label={a.submitSignup} />
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  const { t } = useT();
  const msg = useActionMessage();
  const a = t.auth;
  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBanner message={msg(state.error)} />
      <div className="flex flex-col gap-1">
        <label htmlFor="identifier" className="text-sm font-medium">
          {t.portal.identifier}
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {a.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className={fieldClass}
        />
      </div>
      <SubmitButton label={a.submitLogin} />
    </form>
  );
}
