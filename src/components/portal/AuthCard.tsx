"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AuthState,
  loginAction,
  signupAction,
} from "@/app/actions/auth";
import { useActionMessage, useT } from "@/components/I18nProvider";

type Mode = "signup" | "login";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 8h10m0 0L8.5 4m4 4L8.5 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button type="submit" className="portal-submit" disabled={pending}>
      {pending ? t.auth.pending : label}
      {!pending && <ArrowIcon />}
    </button>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="portal-error">
      {message}
    </p>
  );
}

/** Champ mot de passe avec bascule Afficher/Masquer (état local). */
function PasswordField({
  id,
  name,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="portal-pw">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="portal-pw-toggle"
        onClick={() => setShow((v) => !v)}
        aria-pressed={show}
      >
        {show ? t.portal.hidePassword : t.portal.showPassword}
      </button>
    </div>
  );
}

function SignupPanel({ handleSuffix }: { handleSuffix: string }) {
  const { t } = useT();
  const p = t.portal;
  const msg = useActionMessage();
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  const ids = useId();

  return (
    <>
      <div className="portal-card-head">
        <h2 className="portal-card-title">{p.signupHeading}</h2>
        <p className="portal-card-sub">{p.signupSubtitle}</p>
      </div>
      <form action={action} className="portal-form">
        <ErrorBanner message={msg(state.error)} />

        <div className="portal-field">
          <label className="portal-label" htmlFor={`${ids}-name`}>
            {p.displayName}
          </label>
          <input
            id={`${ids}-name`}
            name="displayName"
            type="text"
            required
            autoComplete="name"
            className="portal-input"
            placeholder={p.displayNamePlaceholder}
          />
        </div>

        <div className="portal-field">
          <label className="portal-label" htmlFor={`${ids}-handle`}>
            {p.handle}
          </label>
          <div className="portal-handle">
            <span className="portal-handle-at" aria-hidden="true">
              @
            </span>
            <input
              id={`${ids}-handle`}
              name="handle"
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              className="portal-handle-input"
              aria-describedby={`${ids}-handle-hint`}
            />
            <span className="portal-handle-suffix">{handleSuffix}</span>
          </div>
          <p id={`${ids}-handle-hint`} className="portal-hint">
            {p.handleHint}
          </p>
        </div>

        <div className="portal-field">
          <label className="portal-label" htmlFor={`${ids}-email`}>
            {p.email}
          </label>
          <input
            id={`${ids}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className="portal-input"
            placeholder={p.emailPlaceholder}
          />
        </div>

        <div className="portal-field">
          <label className="portal-label" htmlFor={`${ids}-pw`}>
            {p.password}
          </label>
          <PasswordField
            id={`${ids}-pw`}
            name="password"
            autoComplete="new-password"
            minLength={8}
          />
          <p className="portal-hint">{p.passwordHint}</p>
        </div>

        <SubmitButton label={p.submitSignup} />

        <p className="portal-legal">
          {p.legalBefore} <Link href="/charte">{p.legalCharter}</Link>{" "}
          {p.legalAnd} <Link href="/confidentialite">{p.legalPrivacy}</Link>{" "}
          {p.legalAfter}
        </p>
      </form>
    </>
  );
}

function LoginPanel() {
  const { t } = useT();
  const p = t.portal;
  const msg = useActionMessage();
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  const ids = useId();

  return (
    <>
      <div className="portal-card-head">
        <h2 className="portal-card-title">{p.loginHeading}</h2>
        <p className="portal-card-sub">{p.loginSubtitle}</p>
      </div>
      <form action={action} className="portal-form">
        <ErrorBanner message={msg(state.error)} />

        <div className="portal-field">
          <label className="portal-label" htmlFor={`${ids}-id`}>
            {p.identifier}
          </label>
          <input
            id={`${ids}-id`}
            name="email"
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            className="portal-input"
          />
        </div>

        <div className="portal-field">
          <div className="portal-label-row">
            <label className="portal-label" htmlFor={`${ids}-pw`}>
              {p.password}
            </label>
            <Link href="/" className="portal-forgot">
              {p.forgotPassword}
            </Link>
          </div>
          <PasswordField
            id={`${ids}-pw`}
            name="password"
            autoComplete="current-password"
          />
        </div>

        <SubmitButton label={p.submitLogin} />
      </form>
    </>
  );
}

/**
 * Carte d'authentification à onglets du portail visiteur. La bascule
 * inscription/connexion se fait *uniquement* via les onglets. Branchée sur les
 * server actions existantes (`signupAction`/`loginAction`).
 */
export function AuthCard({ handleSuffix }: { handleSuffix: string }) {
  const { t } = useT();
  const p = t.portal;
  const [mode, setMode] = useState<Mode>("signup");

  return (
    <div className="portal-card">
      <div className="portal-tabs" role="tablist" aria-label={p.tabSignup}>
        <button
          type="button"
          role="tab"
          id="portal-tab-signup"
          aria-selected={mode === "signup"}
          aria-controls="portal-panel"
          className="portal-tab"
          onClick={() => setMode("signup")}
        >
          {p.tabSignup}
        </button>
        <button
          type="button"
          role="tab"
          id="portal-tab-login"
          aria-selected={mode === "login"}
          aria-controls="portal-panel"
          className="portal-tab"
          onClick={() => setMode("login")}
        >
          {p.tabLogin}
        </button>
      </div>

      <div
        id="portal-panel"
        role="tabpanel"
        aria-labelledby={mode === "signup" ? "portal-tab-signup" : "portal-tab-login"}
      >
        {mode === "signup" ? (
          <SignupPanel handleSuffix={handleSuffix} />
        ) : (
          <LoginPanel />
        )}
      </div>
    </div>
  );
}
