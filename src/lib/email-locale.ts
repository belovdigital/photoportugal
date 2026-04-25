import { queryOne } from "@/lib/db";

export type Locale = "en" | "pt" | "de" | "es" | "fr";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "pt", "de", "es", "fr"] as const;

export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return "en";
  const lc = input.slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(lc) ? (lc as Locale) : "en";
}

/**
 * Look up a user's locale by email or id. Falls back to "en".
 * Use this before sending any client-facing email/SMS.
 */
export async function getUserLocaleByEmail(email: string): Promise<Locale> {
  if (!email) return "en";
  const row = await queryOne<{ locale: string | null }>(
    "SELECT locale FROM users WHERE email = $1 LIMIT 1",
    [email]
  ).catch(() => null);
  return normalizeLocale(row?.locale);
}

export async function getUserLocaleById(userId: string): Promise<Locale> {
  if (!userId) return "en";
  const row = await queryOne<{ locale: string | null }>(
    "SELECT locale FROM users WHERE id = $1 LIMIT 1",
    [userId]
  ).catch(() => null);
  return normalizeLocale(row?.locale);
}

/**
 * Pick a translation from a dict keyed by locale. EN is required as the fallback.
 *   pickT({ en: "Hi", pt: "Olá", de: "Hallo" }, "de") → "Hallo"
 *   pickT({ en: "Hi", pt: "Olá" }, "fr") → "Hi" (falls back when locale not provided)
 */
export function pickT<T>(dict: Partial<Record<Locale, T>> & { en: T }, locale: Locale): T {
  return dict[locale] ?? dict.en;
}

/**
 * Format currency per locale convention used elsewhere on the site.
 *   pt: "150€"   de/es/fr: "150 €"   en: "€150"
 */
export function formatPrice(amount: number, locale: Locale): string {
  const n = Math.round(amount);
  if (locale === "pt") return `${n}€`;
  if (locale === "de" || locale === "es" || locale === "fr") return `${n} €`;
  return `€${n}`;
}

/**
 * Build a locale-prefixed URL: /pt/foo, /de/bar, /baz (en is bare).
 */
export function localizedUrl(path: string, locale: Locale, base = "https://photoportugal.com"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") return `${base}${clean}`;
  return `${base}/${locale}${clean}`;
}
