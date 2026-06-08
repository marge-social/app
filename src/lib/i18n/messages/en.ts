/**
 * **English** dictionary. Must mirror the shape of `fr.ts` (typed `Messages`) —
 * a missing or extra key is a compile error.
 */
import type { Messages } from "./fr";

const en: Messages = {
  meta: {
    title: "Marge",
    description:
      "A social platform for long-form, sourced and federated content — against the attention economy.",
  },
  common: {
    skipToContent: "Skip to content",
    language: "Language",
  },
  nav: {
    mainLabel: "Main navigation",
    searchLabel: "Search",
    searchPlaceholder: "Search…",
    search: "Search",
    write: "Write",
    notifications: "Notifications",
    unread: { one: "{n} unread", other: "{n} unread" },
    unreadNotifications: {
      one: "{n} unread notification",
      other: "{n} unread notifications",
    },
    admin: "Admin",
    profile: "Profile",
    preferences: "Preferences",
    logout: "Log out",
    login: "Log in",
    signup: "Sign up",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  footer: {
    legal: "Legal notice",
  },
  auth: {
    loginTitle: "Log in",
    signupTitle: "Create an account",
    noAccount: "No account yet?",
    haveAccount: "Already registered?",
    createAccountLink: "Create an account",
    loginLink: "Log in",
    displayName: "Display name",
    handle: "Handle",
    handleHelp:
      "Lowercase letters, digits, hyphens. This forms your federated identity.",
    email: "Email",
    password: "Password",
    passwordHelp: "At least 8 characters.",
    submitSignup: "Create my account",
    submitLogin: "Log in",
    pending: "Please wait…",
  },
};

export default en;
