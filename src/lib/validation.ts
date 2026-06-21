import { z } from "zod";

// Les messages Zod portent une **clé** i18n (cf. dict.errors), pas du texte :
// l'action renvoie `issues[0].message` tel quel, le formulaire le traduit.
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "handleTooShort")
  .max(32, "handleTooLong")
  .regex(/^[a-z0-9_-]+$/, "handleChars");

// Inscription (nouveau flux en deux temps) : email + mot de passe seulement.
// Le handle et le nom affiché sont choisis ensuite, à l'onboarding.
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("emailInvalid"),
  password: z.string().min(8, "passwordTooShort8").max(256),
});

// Connexion par email **ou** handle (cf. portail « Email ou handle »).
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "identifierRequired"),
  password: z.string().min(1, "passwordRequired"),
});

// Finalisation du profil à l'onboarding : choix du handle + nom + bio.
export const onboardingSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1, "displayNameRequired").max(80),
  bio: z.string().trim().max(500).optional().default(""),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
