import { routing } from "@/i18n/routing";
import { country } from "@/lib/country";
import { HREFLANGS, type Locale } from "@/i18n/config";

const BASE = country.baseUrl;
// The type stays the full set so HREFLANGS and the pathname tables keep their
// shape; only the ITERATED list narrows per market. Emitting an hreflang for a
// locale this market does not serve points Google at a 404.
const LOCALES = country.locales as readonly Locale[];

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

/**
 * Same as localeAlternates but only emits hreflang entries for locales where
 * the content actually exists (DB row present). Use this for content that is
 * not uniformly translated across all 5 locales — e.g. blog posts authored in
 * a single language. Emitting hreflang for a non-existent translation makes
 * Google follow it and find a 308 redirect or a noindex fallback, which is a
 * negative SEO signal: alternate URLs should be indexable on their own.
 */
export function localeAlternatesFiltered(
  path: string,
  locale: string,
  availableLocales: readonly string[]
) {
  const safeLocale = LOCALES.includes(locale as Locale) ? locale as Locale : "en";
  const available = new Set(availableLocales);
  // Always include the current locale (it's the canonical for this page).
  available.add(safeLocale);

  const urls: Partial<Record<Locale, string>> = {};
  for (const loc of LOCALES) {
    if (available.has(loc)) urls[loc] = localizedUrl(path, loc);
  }

  const languages: Record<string, string> = {};
  // x-default points at the EN version when available, otherwise current.
  languages["x-default"] = urls.en ?? urls[safeLocale]!;
  for (const loc of LOCALES) {
    const url = urls[loc];
    if (!url) continue;
    for (const hreflang of HREFLANGS[loc]) {
      languages[hreflang] = url;
    }
  }

  return {
    canonical: urls[safeLocale]!,
    languages,
  };
}

/**
 * Alternates where each locale has its OWN path, not the same path prefixed.
 *
 * Blog translations do not share a slug: the Italian version of
 * /blog/photographing-rome-guide lives at /it/blog/fotografare-roma-guida.
 * Emitting the English slug under an Italian prefix would point hreflang at a
 * URL that does not exist, which is worse than emitting nothing — so this takes
 * the real path per locale and drops any locale this market does not ship.
 */
export function localeAlternatesPerSlug(
  pathByLocale: Record<string, string>,
  locale: string,
) {
  const safeLocale = LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  const urls: Partial<Record<Locale, string>> = {};
  for (const loc of LOCALES) {
    const path = pathByLocale[loc];
    if (path) urls[loc] = localizedUrl(path, loc);
  }
  // The current page is always its own canonical, even if the map is missing it.
  if (!urls[safeLocale] && pathByLocale[safeLocale]) {
    urls[safeLocale] = localizedUrl(pathByLocale[safeLocale], safeLocale);
  }

  const languages: Record<string, string> = {};
  const fallback = urls.en ?? urls[safeLocale];
  if (fallback) languages["x-default"] = fallback;
  for (const loc of LOCALES) {
    const url = urls[loc];
    if (!url) continue;
    for (const hreflang of HREFLANGS[loc]) languages[hreflang] = url;
  }

  return { canonical: urls[safeLocale]!, languages };
}

/**
 * The OpenGraph half of a page's identity: its own canonical URL and its own
 * locale.
 *
 * The root layout used to supply both as defaults, which meant any page that
 * forgot its own `openGraph` block silently claimed to be the English homepage.
 * Facebook and WhatsApp previews for /photoshoots, /for-business and
 * /try-yourself all resolved to the homepage, and every Spanish, German and
 * French page advertised og:locale="en_US" against its own <html lang>.
 *
 * Spread this into `openGraph` alongside title/description/images:
 *
 *   openGraph: { title, description, ...openGraphIdentity(path, locale) }
 */
const OG_LOCALES: Record<string, string> = {
  en: "en_GB",
  pt: "pt_PT",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  it: "it_IT",
};

export function openGraphIdentity(path: string, locale: string) {
  const safeLocale = LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
  return {
    // Next.js replaces the whole `openGraph` object when a page declares one,
    // rather than merging field by field. That is why og:site_name was missing
    // on 24 of 31 pages: every page with its own OpenGraph block silently
    // dropped the layout's. Carrying it in the helper puts it back everywhere
    // the helper is used.
    siteName: country.brand,
    // Every page this helper serves is a website; blog posts override with
    // type: "article" AFTER the spread, and the later key wins.
    type: "website" as const,
    url: localizedUrl(path, safeLocale),
    locale: OG_LOCALES[safeLocale] ?? OG_LOCALES.en,
    alternateLocale: LOCALES.filter((l) => l !== safeLocale).map((l) => OG_LOCALES[l]),
  };
}

/**
 * Trim a meta description to what a result actually shows.
 *
 * Google renders roughly 155–160 characters and cuts mid-word if you let it,
 * so the last thing a searcher reads becomes half a word. This cuts at a
 * word boundary instead, and only when there is something to cut.
 */
export function clampMeta(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, "") + "…";
}
