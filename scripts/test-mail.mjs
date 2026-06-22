// Teste la configuration SMTP de production (mêmes variables que src/lib/mail.ts).
// N'utilise qu'une dépendance de production : nodemailer.
//
//   docker compose exec app node scripts/test-mail.mjs vous@exemple.fr
//
// Sortie : un diagnostic clair (transport détecté, vérification SMTP, envoi).
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) {
  console.error("Usage : node scripts/test-mail.mjs <destinataire@exemple.fr>");
  process.exit(1);
}

const host = (process.env.SMTP_HOST || "").trim();
const from = (process.env.MAIL_FROM || "").trim() || "Marge <no-reply@localhost>";

console.log("— Configuration lue —");
console.log("  SMTP_HOST  :", host || "(vide → transport JOURNAL, aucun envoi réel)");
console.log("  SMTP_PORT  :", process.env.SMTP_PORT || "587");
console.log("  SMTP_SECURE:", process.env.SMTP_SECURE || "false");
console.log("  SMTP_USER  :", process.env.SMTP_USER ? "(défini)" : "(vide)");
console.log("  MAIL_FROM  :", from);

if (!host) {
  console.error(
    "\n✗ SMTP_HOST est vide : en prod, AUCUN email n'est envoyé (l'app écrit\n" +
      "  seulement le lien dans ses logs). Renseignez SMTP_HOST/SMTP_PORT/\n" +
      "  SMTP_USER/SMTP_PASS/MAIL_FROM, puis relancez ce test.",
  );
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port: Number(process.env.SMTP_PORT ?? "587"),
  secure: (process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS }
    : undefined,
});

try {
  console.log("\n→ Vérification de la connexion SMTP (verify)…");
  await transporter.verify();
  console.log("  ✓ Connexion + authentification SMTP OK.");

  console.log(`→ Envoi d'un email de test à ${to}…`);
  const info = await transporter.sendMail({
    from,
    to,
    subject: "Test SMTP — Marge",
    text:
      "Cet email confirme que la configuration SMTP de Marge fonctionne.\n" +
      "Si vous le recevez, l'envoi des liens d'activation est opérationnel.",
  });
  console.log("  ✓ Email accepté par le serveur. messageId :", info.messageId);
  if (info.accepted?.length) console.log("    accepté pour :", info.accepted.join(", "));
  if (info.rejected?.length) console.log("    REJETÉ pour  :", info.rejected.join(", "));
  console.log(
    "\nVérifiez la boîte de réception (et les indésirables). L'acceptation par\n" +
      "le serveur ne garantit pas la délivrabilité : voir SPF/DKIM/DMARC.",
  );
} catch (err) {
  console.error("\n✗ Échec SMTP :", err?.message || err);
  console.error(
    "  Causes fréquentes : hôte/port erronés, identifiants invalides, port 25\n" +
      "  bloqué par l'hébergeur, ou TLS mal réglé (SMTP_SECURE=true ⇒ port 465).",
  );
  process.exitCode = 1;
} finally {
  transporter.close();
}
