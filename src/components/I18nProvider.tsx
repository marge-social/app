"use client";

import { createContext, useContext } from "react";
import {
  interpolate,
  plural as pluralForm,
  type Locale,
  type Plural,
} from "@/lib/i18n/config";
import { type Messages } from "@/lib/i18n/dictionaries";

/**
 * Pont i18n côté client. Les composants serveur résolvent la locale + le
 * dictionnaire (via `getServerI18n`) ; le layout les injecte ici une seule fois,
 * et les composants client lisent via `useI18n()` / `useT()`.
 *
 * Le dictionnaire complet est sérialisé dans le payload (quelques Ko), pas dans
 * le bundle JS initial.
 */
type I18nValue = {
  locale: Locale;
  dict: Messages;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: I18nValue & { children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n doit être utilisé dans un <I18nProvider>.");
  }
  return value;
}

/** Raccourci : renvoie le dictionnaire et des helpers de formatage. */
export function useT() {
  const { locale, dict } = useI18n();
  return {
    locale,
    t: dict,
    interpolate: (template: string, vars?: Record<string, string | number>) =>
      interpolate(template, vars),
    plural: (count: number, forms: Plural, vars?: Record<string, string | number>) =>
      pluralForm(locale, count, forms, vars),
  };
}
