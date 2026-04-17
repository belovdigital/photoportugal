const BASE = "https://photoportugal.com";

/**
 * Generate alternates with hreflang for EN + PT + x-default
 */
export function localeAlternates(path: string, locale: string) {
  const cleanPath = path === "/" ? "" : path;
  const enUrl = `${BASE}${cleanPath}`;
  const ptUrl = `${BASE}/pt${cleanPath}`;

  return {
    canonical: locale === "pt" ? ptUrl : enUrl,
    languages: {
      "en-GB": enUrl,
      "en-US": enUrl,
      "pt-PT": ptUrl,
      "x-default": enUrl,
    },
  };
}
