const BASE = "https://photoportugal.com";

/**
 * Generate alternates with hreflang for EN + PT + DE + ES + FR + x-default
 */
export function localeAlternates(path: string, locale: string) {
  const cleanPath = path === "/" ? "" : path;
  const enUrl = `${BASE}${cleanPath}`;
  const ptUrl = `${BASE}/pt${cleanPath}`;
  const deUrl = `${BASE}/de${cleanPath}`;
  const esUrl = `${BASE}/es${cleanPath}`;
  const frUrl = `${BASE}/fr${cleanPath}`;

  let canonical = enUrl;
  if (locale === "pt") canonical = ptUrl;
  else if (locale === "de") canonical = deUrl;
  else if (locale === "es") canonical = esUrl;
  else if (locale === "fr") canonical = frUrl;

  return {
    canonical,
    languages: {
      "en-GB": enUrl,
      "en-US": enUrl,
      "pt-PT": ptUrl,
      "de-DE": deUrl,
      "es-ES": esUrl,
      "fr-FR": frUrl,
      "x-default": enUrl,
    },
  };
}
