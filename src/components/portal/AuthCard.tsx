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
  value,
  onValueChange,
}: {
  id: string;
  name: string;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
  value?: string;
  onValueChange?: (v: string) => void;
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
        value={value}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
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

// Mots de passe trop simples / devinables (liste courte + motifs), repris du
// prototype : feedback discret, jamais bloquant (le minimum reste 8 caractères).
const WEAK_PASSWORDS = [
  "password",
  "motdepasse",
  "azerty",
  "qwerty",
  "123456",
  "12345678",
  "123456789",
  "000000",
  "111111",
  "abc123",
  "admin",
  "iloveyou",
  "bonjour",
  "soleil",
  "marge",
  "loveyou",
];
function isGuessable(p: string): boolean {
  if (!p) return false;
  const low = p.toLowerCase();
  if (WEAK_PASSWORDS.some((w) => low.includes(w))) return true;
  if (/^(.)\1+$/.test(p)) return true; // un seul caractère répété
  if (/0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg/.test(low))
    return true; // séquences
  return false;
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const { t } = useT();
  const p = t.portal;
  const cLen = value.length >= 8;
  const cMix =
    /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9]/.test(value);
  const cStrong = value.length > 0 && !isGuessable(value);
  const checks = [
    { ok: cLen, label: p.pwReqLength },
    { ok: cMix, label: p.pwReqMix },
    { ok: cStrong, label: p.pwReqCommon },
  ];
  const score = checks.filter((c) => c.ok).length;
  const tier =
    score <= 1 ? p.pwStrengthWeak : score === 2 ? p.pwStrengthMedium : p.pwStrengthStrong;
  return (
    <div className="portal-pw-meter" data-score={score}>
      <div className="portal-pw-bars">
        {[0, 1, 2].map((i) => (
          <span key={i} className="portal-pw-seg" data-on={i < score} />
        ))}
        <span className="portal-pw-tier">{tier}</span>
      </div>
      <ul className="portal-pw-reqs">
        {checks.map((c) => (
          <li key={c.label} data-ok={c.ok}>
            <span className="portal-pw-mark">
              {c.ok ? <CheckMark /> : <span className="portal-pw-dot" />}
            </span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignupConfirmation({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const p = t.portal;
  return (
    <div className="portal-confirm" role="status">
      <div className="portal-confirm-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="portal-confirm-title">{p.emailSentHeading}</h2>
      <p className="portal-confirm-body">{p.emailSentBody}</p>
      <p className="portal-confirm-hint">{p.emailSentHint}</p>
      <button type="button" className="portal-confirm-back" onClick={onBack}>
        {p.emailSentBack}
      </button>
    </div>
  );
}

function SignupPanel({ onSignedUp }: { onSignedUp: () => void }) {
  const { t } = useT();
  const p = t.portal;
  const msg = useActionMessage();
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  const [password, setPassword] = useState("");
  const ids = useId();

  if (state.ok) return <SignupConfirmation onBack={onSignedUp} />;

  return (
    <>
      <div className="portal-card-head">
        <h2 className="portal-card-title">{p.signupHeading}</h2>
        <p className="portal-card-sub">{p.signupSubtitle}</p>
      </div>
      <form action={action} className="portal-form">
        <ErrorBanner message={msg(state.error)} />

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
            value={password}
            onValueChange={setPassword}
          />
          {password.length > 0 ? (
            <PasswordStrength value={password} />
          ) : (
            <p className="portal-hint">{p.passwordHint}</p>
          )}
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
            name="identifier"
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
 * inscription/connexion se fait *uniquement* via les onglets. L'inscription ne
 * demande qu'email + mot de passe (cf. ADR 0006) : un email d'activation est
 * envoyé, puis le profil se configure à l'onboarding.
 */
export function AuthCard() {
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
          <SignupPanel onSignedUp={() => setMode("login")} />
        ) : (
          <LoginPanel />
        )}
      </div>
    </div>
  );
}
