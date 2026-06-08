/**
 * Accès aux dictionnaires — neutre (serveur ET client). Les dictionnaires sont
 * de simples données ; on les importe statiquement (petits, et le `I18nProvider`
 * en sérialise un pour le client).
 */
import { type Locale } from "./config";
import fr, { type Messages } from "./messages/fr";
import en from "./messages/en";

const dictionaries: Record<Locale, Messages> = { fr, en };

export function getDictionary(locale: Locale): Messages {
  return dictionaries[locale];
}

export type { Messages };
