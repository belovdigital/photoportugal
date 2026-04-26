// Photographer-spoken languages are stored as canonical English names
// (e.g. ["English", "Portuguese", "Russian"]). For display we map to
// the active locale via Intl.DisplayNames when possible, falling back
// to a hand-rolled dictionary for the few common ones.

const NAME_TO_BCP47: Record<string, string> = {
  English: "en",
  Portuguese: "pt",
  Spanish: "es",
  French: "fr",
  German: "de",
  Italian: "it",
  Dutch: "nl",
  Russian: "ru",
  Ukrainian: "uk",
  Polish: "pl",
  Romanian: "ro",
  Czech: "cs",
  Greek: "el",
  Hungarian: "hu",
  Bulgarian: "bg",
  Croatian: "hr",
  Serbian: "sr",
  Arabic: "ar",
  Hebrew: "he",
  Persian: "fa",
  Turkish: "tr",
  Hindi: "hi",
  Bengali: "bn",
  Thai: "th",
  Vietnamese: "vi",
  Indonesian: "id",
  Malay: "ms",
  Tagalog: "tl",
  Japanese: "ja",
  Korean: "ko",
  Chinese: "zh",
  Mandarin: "zh",
  Cantonese: "yue",
  Mongolian: "mn",
  Swahili: "sw",
};

const INTL_LOCALE: Record<string, string> = {
  en: "en",
  pt: "pt-PT",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

export function localizeLanguageName(name: string, locale: string): string {
  const code = NAME_TO_BCP47[name];
  if (!code) return name;
  try {
    const fmt = new Intl.DisplayNames([INTL_LOCALE[locale] || locale], { type: "language" });
    const out = fmt.of(code);
    if (!out) return name;
    // Capitalise first letter (ES/FR Intl returns lowercase).
    return out.charAt(0).toUpperCase() + out.slice(1);
  } catch {
    return name;
  }
}

export function localizeLanguageNames(names: string[], locale: string): string[] {
  return names.map((n) => localizeLanguageName(n, locale));
}
