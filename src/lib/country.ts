/**
 * Country pack — every value that differs between Photo Portugal and Photo
 * Spain lives here, keyed by the `COUNTRY` env var.
 *
 * Two rules that must not be broken:
 *
 * 1. **Portugal is the default.** An absent or unrecognised COUNTRY resolves to
 *    the `pt` pack, i.e. today's production behaviour byte for byte. Adding a
 *    country must never change the existing site.
 *
 * 2. **Anything that can reach the browser reads `NEXT_PUBLIC_COUNTRY`.**
 *    Variables without the prefix are stripped from the client bundle and read
 *    as `undefined` there, which silently falls back to Portugal — see the
 *    header/footer locations bug documented in docs/SPAIN.md §6.4.
 */

import { portugalCoverageStats } from "./location-coverage-stats";

export type CountryCode = "pt" | "es";

/** How photographers get paid out. */
export type PayoutMode =
  /** Stripe Connect express accounts; Stripe moves the money. */
  | "connect"
  /** No Connect: we collect, then pay each photographer by bank transfer. */
  | "manual";

export interface CountryPack {
  code: CountryCode;
  /** Brand name as shown to users, in emails and in structured data. */
  brand: string;
  /** Canonical origin, no trailing slash. */
  baseUrl: string;
  /** Bare hostname — used for R2 public host checks and link matching. */
  host: string;
  /** Public R2 host serving uploaded media. */
  filesHost: string;
  /** Transactional sender. */
  emailFrom: string;
  supportEmail: string;
  /** Country name for schema.org areaServed and geo-targeted copy. */
  areaServed: string;
  /**
   * Root-level SEO copy. Full strings rather than a template, because the
   * Portuguese version interpolates a Portugal-only coverage statistic and
   * forcing both markets through one template would either leak that number
   * into Spain or flatten Portugal's existing, ranking copy.
   */
  seo: {
    title: string;
    description: string;
    ogDescription: string;
    keywords: string[];
  };
  /**
   * Social share card. Portugal keeps its hand-designed PNG; Spain generates
   * one at /og so it does not share a card advertising another country.
   */
  ogImage: string;
  /** Region Quick Booking preselects when nothing is detected from the URL. */
  defaultRegionSlug: string;
  /** Data-protection supervisory authority the privacy page points to. */
  dpaName: string;
  dpaUrl: string;
  /** Google Business Profile for the trust badge, or null if the market has none. */
  googleProfileUrl: string | null;
  /** Are the iOS/Android apps published for this market? */
  hasMobileApp: boolean;
  /** Head-office city for schema.org PostalAddress. */
  city: string;
  /** Coordinates of that city, for schema.org geo. */
  geo: { lat: number; lng: number };
  /** Public phone number, or null where the market has none yet. */
  phone: string | null;
  /**
   * International dial code for this market, e.g. "+351".
   *
   * Used when a photographer types a bare local number with no country code.
   * This was hardcoded to +351 everywhere, so a Spanish photographer entering
   * "612345678" had it silently turned into a Portuguese number: the SMS went
   * to a stranger in Portugal (or nowhere) and verification could never pass.
   */
  dialCode: string;
  /** Placeholder showing this market's number format, e.g. "+351 912 345 678". */
  phonePlaceholder: string;
  /** Flag emoji for the dial-code picker. */
  flag: string;
  /** Social profiles for schema.org sameAs. Empty until a market has them. */
  socialLinks: string[];
  /** Languages the support desk actually answers in. */
  contactLanguages: string[];
  /** Wordmark shown in the header and in JSON-LD. */
  logoPath: string;
  /**
   * Icon-only mark for narrow screens. Both markets share `/favicon.svg` —
   * the camera-frame circle carries no country name, so it needs no variant.
   */
  logoIconPath: string;
  /** Locales this market ships. First entry is the default. */
  locales: readonly string[];
  /** IANA timezone used for business-hours logic and date formatting. */
  timezone: string;
  payoutMode: PayoutMode;
}

const PACKS: Record<CountryCode, CountryPack> = {
  pt: {
    code: "pt",
    brand: "Photo Portugal",
    baseUrl: "https://photoportugal.com",
    host: "photoportugal.com",
    filesHost: "files.photoportugal.com",
    emailFrom: "Photo Portugal <info@photoportugal.com>",
    supportEmail: "info@photoportugal.com",
    areaServed: "Portugal",
    ogImage: "/og-image.png",
    defaultRegionSlug: "greater-lisbon",
    dpaName: "www.cnpd.pt",
    dpaUrl: "https://www.cnpd.pt",
    googleProfileUrl: "https://g.page/r/CbWG7PogT_K2EBM",
    hasMobileApp: true,
    city: "Lisbon",
    geo: { lat: 38.7223, lng: -9.1393 },
    phone: "+351 308 800 496",
    dialCode: "+351",
    phonePlaceholder: "+351 912 345 678",
    flag: "🇵🇹",
    socialLinks: [
      "https://www.facebook.com/photoportugalofficial",
      "https://www.instagram.com/photoportugal_com/",
      "https://www.linkedin.com/company/photoportugal",
      "https://www.trustpilot.com/review/photoportugal.com",
    ],
    contactLanguages: ["English", "Portuguese"],
    seo: {
      title: "Vacation Photographer Portugal — Book Professional Photoshoots | Photo Portugal",
      description: `Book a hand-picked vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & ${portugalCoverageStats.displayPlacesLabel} places. Every photographer personally vetted. Verified reviews, secure payments, private photo gallery. From EUR299.`,
      ogDescription: `Book a professional vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & ${portugalCoverageStats.displayPlacesLabel} places.`,
      keywords: [
        "photographer portugal",
        "vacation photographer lisbon",
        "photoshoot portugal",
        "couples photographer porto",
        "family photographer algarve",
        "professional photographer portugal",
      ],
    },
    logoPath: "/logo.svg",
    logoIconPath: "/favicon.svg",
    locales: ["en", "pt", "de", "es", "fr"],
    timezone: "Europe/Lisbon",
    payoutMode: "connect",
  },
  es: {
    code: "es",
    brand: "Photo Spain",
    baseUrl: "https://photospain.co",
    host: "photospain.co",
    filesHost: "files.photospain.co",
    emailFrom: "Photo Spain <info@photospain.co>",
    supportEmail: "info@photospain.co",
    areaServed: "Spain",
    // No Spanish phone line and no social profiles yet — emitting Portugal's
    // would be a false signal to both Google and visitors.
    ogImage: "/og",
    defaultRegionSlug: "catalonia",
    dpaName: "www.aepd.es",
    dpaUrl: "https://www.aepd.es",
    googleProfileUrl: null,
    hasMobileApp: false,
    city: "Madrid",
    geo: { lat: 40.4168, lng: -3.7038 },
    phone: null,
    dialCode: "+34",
    phonePlaceholder: "+34 612 345 678",
    flag: "🇪🇸",
    socialLinks: [],
    contactLanguages: ["English", "Spanish"],
    seo: {
      title: "Vacation Photographer Spain — Book Professional Photoshoots | Photo Spain",
      description:
        "Book a hand-picked vacation photographer in Spain. Barcelona, Madrid, Seville, Granada, Mallorca & 24 places. Every photographer personally vetted. Verified reviews, secure payments, private photo gallery.",
      ogDescription:
        "Book a professional vacation photographer in Spain. Barcelona, Madrid, Seville, Granada, Mallorca & 24 places.",
      keywords: [
        "photographer spain",
        "vacation photographer barcelona",
        "photoshoot spain",
        "couples photographer madrid",
        "family photographer seville",
        "professional photographer spain",
      ],
    },
    logoPath: "/logo-es.png",
    logoIconPath: "/favicon.svg",
    // Portuguese is deliberately absent: it earns nothing in the Spanish market.
    locales: ["en", "es", "de", "fr"],
    timezone: "Europe/Madrid",
    // The operating company is Portuguese and is not registered in Spain, so
    // Stripe Connect onboarding is not available to Spanish photographers.
    // They are paid by bank transfer after the money clears. See docs/SPAIN.md §6.2.
    payoutMode: "manual",
  },
};

function resolve(raw: string | undefined): CountryPack {
  return raw === "es" ? PACKS.es : PACKS.pt;
}

/**
 * Active country pack.
 *
 * Reads NEXT_PUBLIC_COUNTRY first so the value survives into the client bundle,
 * and falls back to the server-only COUNTRY for code that never ships to the
 * browser (crons, scripts). Both are set in the production .env.
 */
export const country: CountryPack = resolve(
  process.env.NEXT_PUBLIC_COUNTRY || process.env.COUNTRY
);

export const isSpain = country.code === "es";
export const isPortugal = country.code === "pt";

/** True when photographers are paid by hand rather than through Stripe Connect. */
export const isManualPayout = country.payoutMode === "manual";
