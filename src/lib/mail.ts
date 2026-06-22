import "server-only";

import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

/**
 * Couche d'envoi d'email transactionnel (activation d'inscription + rappel).
 *
 * Transport unique : **SMTP via nodemailer**, configuré par les variables
 * `SMTP_*` (cf. `.env.example`). En l'absence de configuration SMTP (dev local
 * sans serveur mail), on bascule sur un transport « journal » : l'email — et
 * surtout le **lien d'activation** — est écrit dans la console du serveur, ce
 * qui permet de dérouler tout le flux d'inscription en local sans infra mail.
 *
 * nodemailer est sur la liste blanche de fait : réimplémenter un client SMTP
 * (STARTTLS, AUTH, encodage MIME) à la main serait une faille quasi garantie.
 * Voir l'ADR 0006.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let cachedTransport: Transporter | null | undefined;

/** Adresse d'expéditeur (`MAIL_FROM`), avec un repli lisible en dev. */
function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "marge <no-reply@localhost>";
}

/**
 * Transporteur SMTP paresseux. `null` = SMTP non configuré → transport journal.
 * Mémoïsé pour réutiliser le pool de connexions entre envois.
 */
function getTransport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    cachedTransport = null;
    return cachedTransport;
  }

  const port = Number(process.env.SMTP_PORT ?? "587");
  // `secure` = true ⇒ TLS implicite (port 465). Sinon STARTTLS (587/25).
  const secure = (process.env.SMTP_SECURE ?? "").toLowerCase() === "true";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  return cachedTransport;
}

/** Envoie un email (ou le journalise en console si SMTP non configuré). */
export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    // Transport journal : on rend le lien d'activation immédiatement visible.
    console.info(
      [
        "[mail] SMTP non configuré — email NON envoyé (transport journal).",
        `[mail]   À      : ${message.to}`,
        `[mail]   Objet  : ${message.subject}`,
        `[mail]   Texte  :\n${message.text}`,
      ].join("\n"),
    );
    return;
  }

  await transport.sendMail({
    from: mailFrom(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

// --- Gabarits -------------------------------------------------------------

type Locale = "fr" | "en";

function normalizeLocale(locale: string | undefined): Locale {
  return locale === "en" ? "en" : "fr";
}

/** Coquille HTML sobre, commune à tous les emails (pas de pixel espion, etc.). */
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;background:#f4f4f4;padding:24px;font-family:-apple-system,Segoe UI,system-ui,sans-serif;color:#0f0f0f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e2;border-radius:14px;">
    <tr><td style="padding:30px 32px 26px;">
      <p style="margin:0 0 22px;font-size:20px;font-weight:600;letter-spacing:-0.01em;">marge<span style="color:#7c3a4b;">.</span></p>
      <h1 style="margin:0 0 14px;font-size:21px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;">${title}</h1>
      ${bodyHtml}
    </td></tr>
  </table>
</body>
</html>`;
}

/** Bouton + lien brut (clients qui n'affichent pas les boutons). */
function actionBlock(url: string, label: string, fallbackLabel: string): string {
  return `<p style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#0f0f0f;color:#fafafa;text-decoration:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:9px;">${label}</a>
  </p>
  <p style="margin:0 0 4px;font-size:12.5px;color:#6b6b6b;">${fallbackLabel}</p>
  <p style="margin:0 0 8px;font-size:12.5px;word-break:break-all;"><a href="${url}" style="color:#7c3a4b;">${url}</a></p>`;
}

const COPY = {
  activation: {
    fr: {
      subject: "Activez votre compte marge",
      title: "Bienvenue sur marge",
      intro:
        "Vous venez de créer un compte. Une dernière étape pour le configurer et entrer dans marge :",
      cta: "Configurer mon profil",
      fallback: "Si le bouton ne fonctionne pas, copiez ce lien :",
      expiry:
        "Ce lien reste valable 96 heures. Sans activation, le compte créé sera supprimé.",
      ignore: "Vous n'êtes pas à l'origine de cette inscription ? Ignorez cet email.",
    },
    en: {
      subject: "Activate your marge account",
      title: "Welcome to marge",
      intro:
        "You just created an account. One last step to set it up and enter marge:",
      cta: "Set up my profile",
      fallback: "If the button doesn't work, copy this link:",
      expiry:
        "This link is valid for 96 hours. Without activation, the created account will be deleted.",
      ignore: "Didn't sign up? You can safely ignore this email.",
    },
  },
  reminder: {
    fr: {
      subject: "Votre compte marge vous attend",
      title: "Il vous reste une étape",
      intro:
        "Votre inscription à marge n'est pas encore finalisée. Configurez votre profil pour commencer :",
      cta: "Configurer mon profil",
      fallback: "Si le bouton ne fonctionne pas, copiez ce lien :",
      expiry:
        "Sans activation dans les prochaines 48 heures, le compte créé sera automatiquement supprimé.",
      ignore: "Vous n'êtes pas à l'origine de cette inscription ? Ignorez cet email.",
    },
    en: {
      subject: "Your marge account is waiting",
      title: "One step left",
      intro:
        "Your marge sign-up isn't finished yet. Set up your profile to get started:",
      cta: "Set up my profile",
      fallback: "If the button doesn't work, copy this link:",
      expiry:
        "Without activation within the next 48 hours, the created account will be automatically deleted.",
      ignore: "Didn't sign up? You can safely ignore this email.",
    },
  },
} as const;

function buildEmail(
  kind: "activation" | "reminder",
  url: string,
  locale: Locale,
): { subject: string; text: string; html: string } {
  const c = COPY[kind][locale];
  const text = [
    c.title,
    "",
    c.intro,
    "",
    url,
    "",
    c.expiry,
    c.ignore,
  ].join("\n");
  const html = shell(
    c.title,
    `<p style="margin:0 0 4px;font-size:14.5px;line-height:1.55;color:#3d3d3d;">${c.intro}</p>
     ${actionBlock(url, c.cta, c.fallback)}
     <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #ececec;font-size:12.5px;line-height:1.5;color:#6b6b6b;">${c.expiry}</p>
     <p style="margin:8px 0 0;font-size:12px;color:#a0a0a0;">${c.ignore}</p>`,
  );
  return { subject: c.subject, text, html };
}

/** Email d'activation envoyé à l'inscription, avec le lien d'onboarding. */
export async function sendActivationEmail(
  to: string,
  activationUrl: string,
  locale?: string,
): Promise<void> {
  const { subject, text, html } = buildEmail(
    "activation",
    activationUrl,
    normalizeLocale(locale),
  );
  await sendMail({ to, subject, text, html });
}

/** Rappel envoyé à 48 h si l'inscription n'a pas été activée. */
export async function sendReminderEmail(
  to: string,
  activationUrl: string,
  locale?: string,
): Promise<void> {
  const { subject, text, html } = buildEmail(
    "reminder",
    activationUrl,
    normalizeLocale(locale),
  );
  await sendMail({ to, subject, text, html });
}
