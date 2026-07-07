// Client ↔ photographer language matching.
//
// Photographers store languages as English names in
// photographer_profiles.languages ('English', 'German', 'Portuguese', …).
// A photographer "can communicate" with a client when they share the
// client's language OR speak English (the marketplace lingua franca).
// An EMPTY languages array counts as NO common language — undeclared is
// treated as unbookable-without-warning, not as "probably fine".

const CODE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  de: "German",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
};

export function speaksEnglish(languages: string[] | null | undefined): boolean {
  return (languages || []).some((l) => l.trim().toLowerCase() === "english");
}

/**
 * True when the photographer speaks the client's language or English.
 * `clientLangCode` is a 2-letter code (concierge detectedLang / UI locale).
 * Unknown client codes fall back to requiring English — tourists we can't
 * classify are overwhelmingly English-communicating.
 */
export function hasCommonLanguage(
  clientLangCode: string | null | undefined,
  photographerLanguages: string[] | null | undefined,
): boolean {
  const langs = (photographerLanguages || []).map((l) => l.trim().toLowerCase()).filter(Boolean);
  if (langs.length === 0) return false;
  if (langs.includes("english")) return true;
  const clientLanguage = CODE_TO_LANGUAGE[(clientLangCode || "en").toLowerCase()];
  return clientLanguage ? langs.includes(clientLanguage.toLowerCase()) : false;
}

/** Languages other than English, for the "smaller print" under the badge. */
export function nonEnglishLanguages(languages: string[] | null | undefined): string[] {
  return (languages || []).filter((l) => l.trim().toLowerCase() !== "english" && l.trim() !== "");
}
