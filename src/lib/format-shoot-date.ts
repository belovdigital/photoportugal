// Format a `shoot_date` (or any date-like value) for human display.
// pg returns DATE columns as JS Date objects; if interpolated directly into
// a template literal you get the ugly default toString() — this helper avoids
// that by always using Intl.DateTimeFormat with timeZone:UTC (DATE columns
// don't carry a timezone, so we render the same calendar day everywhere).
//
// Returns null for null/invalid input so callers can branch on truthiness.

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  pt: "pt-PT",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

export function formatShootDate(
  value: unknown,
  locale: string = "en",
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return null;
  const intlLocale = LOCALE_MAP[locale] || "en-GB";
  return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: "UTC" }).format(date);
}
