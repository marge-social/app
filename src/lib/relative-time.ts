/** Formatage de dates sobre et **localisé** (relatif + date longue). */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

// Instances `Intl` mémoïsées par locale (leur construction n'est pas gratuite).
const relativeFormatters = new Map<Locale, Intl.RelativeTimeFormat>();
const longDateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const shortDateFormatters = new Map<Locale, Intl.DateTimeFormat>();

function relativeFormatter(locale: Locale): Intl.RelativeTimeFormat {
  let f = relativeFormatters.get(locale);
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeFormatters.set(locale, f);
  }
  return f;
}

function longDateFormatter(locale: Locale): Intl.DateTimeFormat {
  let f = longDateFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    longDateFormatters.set(locale, f);
  }
  return f;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** Horodatage relatif localisé (ex. « il y a 2 heures » / "2 hours ago"). */
export function relativeTime(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
  now: Date = new Date(),
): string {
  const rtf = relativeFormatter(locale);
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSec = Math.abs(diffSec);
  // En deçà de 45 s : « maintenant » / "now" (rendu localisé par Intl).
  if (absSec < 45) return rtf.format(0, "second");
  for (const [unit, secondsInUnit] of UNITS) {
    if (absSec >= secondsInUnit) {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}

/** Date longue localisée (ex. « 8 juin 2026 » / "June 8, 2026 »). */
export function formatLongDate(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return longDateFormatter(locale).format(date);
}

/** Date courte localisée, sans année (ex. « 8 juin » / "June 8"). */
export function formatShortDate(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
): string {
  let f = shortDateFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
    shortDateFormatters.set(locale, f);
  }
  return f.format(date);
}
