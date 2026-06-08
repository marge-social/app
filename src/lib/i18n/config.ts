/**
 * Configuration i18n — neutre (utilisable côté serveur ET client).
 *
 * Marge traduit son **interface** seulement : les contenus (articles, notes)
 * restent dans la langue de leur auteur. La langue ne vit JAMAIS dans l'URL
 * (cookie + préférence en base) pour ne pas perturber les permaliens fédérés.
 */

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Nom du cookie portant la préférence de langue (lisible côté JS, non sensible). */
export const LOCALE_COOKIE = "locale";

/** Durée de vie du cookie de langue : 1 an. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Endonymes (le nom d'une langue dans cette langue) — identiques quelle que soit l'UI. */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Résout une locale supportée depuis un en-tête `Accept-Language`.
 * On ne compare que la sous-balise primaire (`fr-CA` → `fr`). Renvoie null si
 * aucune langue supportée n'est trouvée (l'appelant retombera sur le défaut).
 */
export function matchAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

/**
 * Remplace les marqueurs `{clef}` d'un gabarit par les valeurs fournies.
 * Un marqueur sans valeur correspondante est laissé tel quel (aide au debug).
 */
export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Une entrée pluralisable : la bonne forme est choisie via `Intl.PluralRules`. */
export type Plural = { one: string; other: string };

/**
 * Sélectionne la forme plurielle adaptée à `count` pour la locale, puis
 * interpole. Le compte est exposé sous `{n}` (et peut être complété par `vars`).
 */
export function plural(
  locale: Locale,
  count: number,
  forms: Plural,
  vars?: Record<string, string | number>,
): string {
  const rule = new Intl.PluralRules(locale).select(count);
  const form = rule === "one" ? forms.one : forms.other;
  return interpolate(form, { n: count, ...vars });
}
