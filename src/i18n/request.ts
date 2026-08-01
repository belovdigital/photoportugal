import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { country } from "@/lib/country";

// Deep-merge fallback (en) with target locale so partial translations work:
// any key missing in es/fr/de/pt falls back to the English string.
// Arrays are NOT merged — replaced wholesale — otherwise the merge spreads
// numeric indices into a plain object and `.map` fails at the call site.
function deepMerge<T>(base: T, override: T): T {
  if (typeof base !== "object" || base === null) return override ?? base;
  if (typeof override !== "object" || override === null) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    const o = (override as Record<string, unknown>)[k];
    out[k] = b !== undefined && typeof b === "object" && typeof o === "object" ? deepMerge(b, o) : o;
  }
  return out as T;
}

/**
 * Per-market copy overrides: `messages/country/{market}/{locale}.json`.
 *
 * These files hold ONLY the keys a market words differently — its own footer,
 * meta titles, whatever. Everything else keeps coming from the shared
 * catalogue, so there is no duplicated set of translations to drift apart.
 *
 * Why this is safe to edit without touching another country: the file is
 * physically scoped to one market. Editing `messages/country/es/es.json`
 * cannot change a byte of what Portugal renders, because Portugal never loads
 * that file. The blast radius is the directory name.
 *
 * The override is merged LAST and always within its own locale, so a market's
 * English wording can never leak into its Spanish rendering or the reverse.
 *
 * A missing file is the normal case — Portugal has none — and is not an error.
 */
async function countryOverride(locale: string): Promise<Record<string, unknown> | null> {
  try {
    return (await import(`../../messages/country/${country.code}/${locale}.json`)).default;
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }

  const en = (await import(`../../messages/en.json`)).default;

  let messages;
  if (locale === "en") {
    messages = en;
  } else {
    try {
      const target = (await import(`../../messages/${locale}.json`)).default;
      messages = deepMerge(en, target);
    } catch {
      messages = en;
    }
  }

  const override = await countryOverride(locale);
  if (override) messages = deepMerge(messages, override);

  return { locale, messages };
});
