/**
 * Dictionnaire **français** — source de vérité de la forme des messages.
 *
 * Le type `Messages` est dérivé de cet objet : toute autre langue (en.ts…) doit
 * en respecter exactement la structure, sinon erreur de compilation. Les chaînes
 * sont volontairement laissées « larges » (string) pour que les traductions
 * puissent diverger.
 *
 * Les entrées de la forme `{ one, other }` sont pluralisées via `plural()`.
 * Les marqueurs `{x}` sont remplis via `interpolate()`.
 */
const fr = {
  meta: {
    title: "Marge",
    description:
      "Un média social de contenus longs, sourcés et fédérés — à contre-courant de l'économie attentionnelle.",
  },
  common: {
    skipToContent: "Aller au contenu",
    language: "Langue",
  },
  nav: {
    mainLabel: "Navigation principale",
    searchLabel: "Rechercher",
    searchPlaceholder: "Rechercher…",
    search: "Recherche",
    write: "Écrire",
    notifications: "Notifications",
    unread: { one: "{n} non lue", other: "{n} non lues" },
    unreadNotifications: {
      one: "{n} notification non lue",
      other: "{n} notifications non lues",
    },
    admin: "Admin",
    profile: "Profil",
    preferences: "Préférences",
    logout: "Se déconnecter",
    login: "Se connecter",
    signup: "Créer un compte",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  footer: {
    legal: "Mentions légales",
  },
  auth: {
    loginTitle: "Se connecter",
    signupTitle: "Créer un compte",
    noAccount: "Pas encore de compte ?",
    haveAccount: "Déjà inscrit·e ?",
    createAccountLink: "Créer un compte",
    loginLink: "Se connecter",
    displayName: "Nom affiché",
    handle: "Handle",
    handleHelp:
      "Lettres minuscules, chiffres, tirets. Formera ton identité fédérée.",
    email: "Email",
    password: "Mot de passe",
    passwordHelp: "Au moins 8 caractères.",
    submitSignup: "Créer mon compte",
    submitLogin: "Se connecter",
    pending: "Patiente…",
  },
};

export type Messages = typeof fr;
export default fr;
