import { z } from "zod";

/**
 * Handle : minuscules, chiffres, tirets/underscores. 2–32 caractères.
 * Sert de partie locale du handle fédéré et de segment d'URL d'acteur.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Le handle doit faire au moins 2 caractères.")
  .max(32, "Le handle ne peut dépasser 32 caractères.")
  .regex(
    /^[a-z0-9_-]+$/,
    "Le handle ne peut contenir que des lettres minuscules, chiffres, tirets et underscores.",
  );

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères.")
    .max(256),
  handle: handleSchema,
  displayName: z.string().trim().min(1, "Le nom affiché est requis.").max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
