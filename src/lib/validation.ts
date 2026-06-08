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

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("emailInvalid"),
  password: z.string().min(8, "passwordTooShort8").max(256),
  handle: handleSchema,
  displayName: z.string().trim().min(1, "displayNameRequired").max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("emailInvalid"),
  password: z.string().min(1, "passwordRequired"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
