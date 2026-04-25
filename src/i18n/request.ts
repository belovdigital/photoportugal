import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Deep-merge fallback (en) with target locale so partial translations work:
// any key missing in es/fr/de/pt falls back to the English string.
function deepMerge<T>(base: T, override: T): T {
  if (typeof base !== "object" || base === null) return override ?? base;
  if (typeof override !== "object" || override === null) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    const o = (override as Record<string, unknown>)[k];
    out[k] = b !== undefined && typeof b === "object" && typeof o === "object" ? deepMerge(b, o) : o;
  }
  return out as T;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }
  const en = (await import(`../../messages/en.json`)).default;
  if (locale === "en") return { locale, messages: en };
  let target;
  try {
    target = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return { locale, messages: en };
  }
  return { locale, messages: deepMerge(en, target) };
});
