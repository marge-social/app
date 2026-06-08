import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  matchAcceptLanguage,
  type Locale,
} from "./config";
import { getDictionary, type Messages } from "./dictionaries";

/**
 * Résout la locale effective de la requête, dans l'ordre :
 *   1. cookie `locale` (choix explicite, posé par le sélecteur de langue) ;
 *   2. préférence en base de l'utilisateur connecté (cross-device) ;
 *   3. en-tête `Accept-Language` du navigateur ;
 *   4. défaut de l'instance (`fr`).
 *
 * Mémoïsé par requête (`cache`) : appelé par le layout ET par chaque composant
 * serveur qui a besoin du dictionnaire, sans recalcul.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  // Pas de cookie : retombe sur la préférence persistée (nouvel appareil).
  // getCurrentUser() retourne vite (null) en l'absence de session.
  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;

  const fromHeader = matchAcceptLanguage((await headers()).get("accept-language"));
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
});

/** Locale + dictionnaire résolus pour la requête (raccourci pour les pages/composants serveur). */
export const getServerI18n = cache(
  async (): Promise<{ locale: Locale; dict: Messages }> => {
    const locale = await getLocale();
    return { locale, dict: getDictionary(locale) };
  },
);
