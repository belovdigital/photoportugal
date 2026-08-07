import { country } from "@/lib/country";

/**
 * Every locale the codebase knows how to render. This stays fixed across
 * markets so the `Locale` union — referenced in dozens of signatures, hreflang
 * maps and pathname tables — never changes shape when a country is added.
 */
export const ALL_LOCALES = ["en", "pt", "de", "es", "fr", "it"] as const;
export type Locale = (typeof ALL_LOCALES)[number];

/**
 * Locales this market actually ships, taken from the country pack.
 *
 * Portugal keeps all five, so its behaviour is unchanged. Spain drops `pt`:
 * without this the middleware redirected photospain.co/ straight to /pt and
 * served a Portuguese-language homepage on the Spanish site to anyone whose
 * browser asked for Portuguese. Caught by smoke test on the first deploy.
 */
export const locales = country.locales as readonly Locale[];

export const defaultLocale: Locale = "en";

/**
 * hreflang values emitted per locale. Single source of truth: both the page
 * metadata (`lib/seo.ts`) and the sitemap read it. A locale missing here reads
 * as `undefined` at the iteration site and takes the whole page down, which is
 * exactly what adding Italian did while two copies of this table existed.
 */
export const HREFLANGS: Record<Locale, string[]> = {
  en: ["en-GB", "en-US"],
  pt: ["pt-PT"],
  de: ["de-DE"],
  es: ["es-ES"],
  fr: ["fr-FR"],
  it: ["it-IT"],
};

/** Is this locale served in the current market? */
export function isActiveLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
