"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AuthState,
  loginAction,
  signupAction,
} from "@/app/actions/auth";

const fieldClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Patiente…" : label}
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
  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBanner message={state.error} />
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          Nom affiché
        </label>
        <input id="displayName" name="displayName" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="handle" className="text-sm font-medium">
          Handle
        </label>
        <input
          id="handle"
          name="handle"
          required
          autoCapitalize="none"
          autoCorrect="off"
          className={fieldClass}
          aria-describedby="handle-help"
        />
        <p id="handle-help" className="text-xs text-foreground/60">
          Lettres minuscules, chiffres, tirets. Formera ton identité fédérée.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
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
          Au moins 8 caractères.
        </p>
      </div>
      <SubmitButton label="Créer mon compte" />
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <ErrorBanner message={state.error} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className={fieldClass}
        />
      </div>
      <SubmitButton label="Se connecter" />
    </form>
  );
}
