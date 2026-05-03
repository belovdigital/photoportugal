import { routing } from "@/i18n/routing";

const BASE = "https://photoportugal.com";
const LOCALES = ["en", "pt", "de", "es", "fr"] as const;
type Locale = (typeof LOCALES)[number];
const HREFLANGS: Record<Locale, string[]> = {
  en: ["en-GB", "en-US"],
  pt: ["pt-PT"],
  de: ["de-DE"],
  es: ["es-ES"],
  fr: ["fr-FR"],
};

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function compilePathPattern(pattern: string) {
  const names: string[] = [];
  const source = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[([^/\]]+)\\\]/g, (_match, name: string) => {
      names.push(name);
      return "([^/]+)";
    });
  return { regex: new RegExp(`^${source}$`), names };
}

function localizedPath(path: string, locale: Locale) {
  const cleanPath = normalizePath(path);
  const entries = Object.entries(routing.pathnames).sort((a, b) => b[0].length - a[0].length);

  for (const [pattern, localized] of entries) {
    const { regex, names } = compilePathPattern(pattern);
    const match = cleanPath.match(regex);
    if (!match) continue;

    const targetPattern = typeof localized === "string"
      ? localized
      : localized[locale] || localized.en || pattern;

    return names.reduce((acc, name, index) => (
      acc.replace(`[${name}]`, match[index + 1] || "")
    ), targetPattern);
  }

  return cleanPath;
}

export function localizedUrl(path: string, locale: Locale) {
  const pathForLocale = localizedPath(path, locale);
  const suffix = pathForLocale === "/" ? "" : pathForLocale;
  return locale === "en" ? `${BASE}${suffix}` : `${BASE}/${locale}${suffix}`;
}

/**
 * Generate alternates with hreflang for EN + PT + DE + ES + FR + x-default
 */
export function localeAlternates(path: string, locale: string) {
  const safeLocale = LOCALES.includes(locale as Locale) ? locale as Locale : "en";
  const urls = Object.fromEntries(LOCALES.map((loc) => [loc, localizedUrl(path, loc)])) as Record<Locale, string>;

  const languages: Record<string, string> = { "x-default": urls.en };
  for (const loc of LOCALES) {
    for (const hreflang of HREFLANGS[loc]) {
      languages[hreflang] = urls[loc];
    }
  }

  return {
    canonical: urls[safeLocale],
    languages,
  };
}
