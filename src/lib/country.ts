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

export type CountryCode = "pt" | "es" | "it";

/** Locales any market can ship. Each pack picks its own subset in `locales`. */
type LocaleKey = "en" | "pt" | "de" | "es" | "fr" | "it";

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
   * The same country name, declined per locale, for copy the visitor reads.
   * `areaServed` is the schema.org value and is always English, which reads
   * as a bug inside Spanish or French sentences ("cuenta bancaria en Spain").
   */
  countryName: Record<LocaleKey, string>;
  /**
   * "in <country>", with the preposition already correct for each language.
   * A template cannot do this: French takes "au Portugal" but "en Espagne",
   * and naive substitution is exactly how "au Espagne" shipped once already.
   */
  countryIn: Record<LocaleKey, string>;
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
  /**
   * The founder's own photographer profile, or null where she has none. The
   * founder story runs on every market, but only Portugal has the profile
   * behind it — Spain and Italy linked it anyway and sent both visitors and
   * Google to a 308 back to the catalogue.
   */
  founderProfileSlug: string | null;
  /** Are the iOS/Android apps published for this market? */
  hasMobileApp: boolean;
  /**
   * May the monthly photographer digest go out here?
   *
   * It reports the last 30 days and is addressed "your month on <brand>". A
   * market whose roster is days old has no month to report: Spain's first
   * digest (2026-08-10) told a photographer approved five days earlier that
   * she had 7 profile views — three of which were us opening her profile.
   * Off until a market has a real month of traffic behind it.
   */
  photographerDigest: boolean;
  /**
   * Intercom workspace, or null for a market that runs without live chat.
   * Gates both the widget and the server-side contact sync — a null here
   * must never let a market's users leak into another market's inbox.
   *
   * Null in every market since 2026-08-11: Portugal's workspace was switched
   * off deliberately (the concierge covers chat), so a null here is the
   * intended state, not a missing config value. Don't "restore" it.
   */
  intercomAppId: string | null;
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
  /**
   * The market's own language: locale code plus a label an LLM prompt can use.
   * Assistant copy offers English and this, never another market's language.
   * The chat reply suggestions used to branch "European Portuguese or English",
   * so a Spanish photographer writing to a Spanish client was handed English.
   * Kept separate from `code` because a future market's country code and
   * language code need not match.
   */
  nativeLocale: string;
  languageLabel: string;
  /** IANA timezone used for business-hours logic and date formatting. */
  timezone: string;
  /** Year this market opened. Quoted as fact in llms.txt, so it must be its own. */
  foundedYear: number;
  /**
   * Does this market have photography of its own locations?
   *
   * Portugal does. Spain and Italy currently borrow Portuguese photos, chosen
   * by character, as placeholders. That is fine as decoration and a lie as a
   * caption: an audit found /locations/rome serving a picture of Lisbon's Tram
   * 28 — Portuguese street sign in frame — under `og:image:alt` "Rome, Italy",
   * and the same file submitted to Google Images titled "Vacation photography
   * in Rome, Italy". Where this is false the pictures stay, but nothing claims
   * they show the place.
   */
  hasOwnLocationImagery: boolean;
  /**
   * May the other markets link here?
   *
   * A market with no approved photographers is a dead end: the visitor clicks
   * through from a working site, finds an empty catalogue, and we have spent
   * real traffic to show them nothing. Flip to true once the roster can take a
   * booking.
   */
  listedInSiblings: boolean;
  /**
   * Whether the concierge may send a live booking lead to this market's site.
   *
   * Separate from `listedInSiblings` on purpose: a footer link is an
   * invitation to look around, and costs nothing if the catalogue is still
   * filling up. Telling someone mid-conversation "we have a sister site for
   * Italy, go there" spends a real lead — and spends it on an empty results
   * page if the roster is not live yet.
   */
  referralsWelcome: boolean;
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
    countryName: { en: "Portugal", pt: "Portugal", de: "Portugal", es: "Portugal", fr: "Portugal", it: "Portogallo" },
    countryIn: { en: "in Portugal", pt: "em Portugal", de: "in Portugal", es: "en Portugal", fr: "au Portugal", it: "in Portogallo" },
    ogImage: "/og-image.png",
    defaultRegionSlug: "greater-lisbon",
    dpaName: "www.cnpd.pt",
    dpaUrl: "https://www.cnpd.pt",
    googleProfileUrl: "https://g.page/r/CbWG7PogT_K2EBM",
    founderProfileSlug: "kate-belova",
    hasMobileApp: true,
    photographerDigest: true,
    intercomAppId: null,
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
      description: `Book a hand-picked vacation photographer in Portugal. Lisbon, Porto, Algarve, Sintra & ${portugalCoverageStats.displayPlacesLabel} places. Every photographer personally vetted. Verified reviews, secure payments, private photo gallery. From EUR279 all-in.`,
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
    nativeLocale: "pt",
    languageLabel: "European Portuguese",
    timezone: "Europe/Lisbon",
    foundedYear: 2024,
    hasOwnLocationImagery: true,
    listedInSiblings: true,
    referralsWelcome: true,
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
    countryName: { en: "Spain", pt: "Espanha", de: "Spanien", es: "España", fr: "Espagne", it: "Spagna" },
    countryIn: { en: "in Spain", pt: "em Espanha", de: "in Spanien", es: "en España", fr: "en Espagne", it: "in Spagna" },
    // No Spanish phone line and no social profiles yet — emitting Portugal's
    // would be a false signal to both Google and visitors.
    ogImage: "/og",
    defaultRegionSlug: "catalonia",
    dpaName: "www.aepd.es",
    dpaUrl: "https://www.aepd.es",
    googleProfileUrl: null,
    founderProfileSlug: null,
    hasMobileApp: false,
    photographerDigest: false,
    intercomAppId: null,
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
    nativeLocale: "es",
    languageLabel: "peninsular Spanish",
    timezone: "Europe/Madrid",
    foundedYear: 2026,
    hasOwnLocationImagery: false,
    listedInSiblings: true,
    referralsWelcome: true,
  },
  it: {
    code: "it",
    brand: "Photo Italy",
    baseUrl: "https://photoitaly.co",
    host: "photoitaly.co",
    filesHost: "files.photoitaly.co",
    emailFrom: "Photo Italy <info@photoitaly.co>",
    supportEmail: "info@photoitaly.co",
    areaServed: "Italy",
    countryName: { en: "Italy", pt: "Itália", de: "Italien", es: "Italia", fr: "Italie", it: "Italia" },
    countryIn: { en: "in Italy", pt: "em Itália", de: "in Italien", es: "en Italia", fr: "en Italie", it: "in Italia" },
    // No Italian phone line, social profiles or Google Business Profile yet.
    // Emitting Portugal's would be a false signal to Google and to visitors.
    ogImage: "/og",
    defaultRegionSlug: "lazio",
    dpaName: "Garante per la protezione dei dati personali",
    dpaUrl: "https://www.garanteprivacy.it",
    googleProfileUrl: null,
    founderProfileSlug: null,
    hasMobileApp: false,
    photographerDigest: false,
    intercomAppId: null,
    city: "Rome",
    geo: { lat: 41.9028, lng: 12.4964 },
    phone: null,
    dialCode: "+39",
    phonePlaceholder: "+39 312 345 6789",
    flag: "🇮🇹",
    socialLinks: [],
    contactLanguages: ["English", "Italian"],
    seo: {
      title: "Vacation Photographer Italy — Book Professional Photoshoots | Photo Italy",
      description:
        "Book a hand-picked vacation photographer in Italy. Rome, Florence, Venice, the Amalfi Coast, Milan and beyond. Every photographer personally vetted. Verified reviews, secure payments, private photo gallery.",
      ogDescription:
        "Book a professional vacation photographer in Italy. Rome, Florence, Venice, the Amalfi Coast and beyond.",
      keywords: [
        "photographer italy",
        "vacation photographer rome",
        "photoshoot italy",
        "couples photographer venice",
        "family photographer florence",
        "professional photographer italy",
      ],
    },
    logoPath: "/logo-it.png",
    logoIconPath: "/favicon.svg",
    // Portuguese is deliberately absent — the flow from Portugal to Italy is
    // too small to be worth a locale nobody keeps honest. Spanish stays: Spain
    // is one of Italy's largest inbound markets and the catalogue already
    // exists, so it costs a country override and nothing else.
    locales: ["en", "it", "de", "fr", "es"],
    nativeLocale: "it",
    languageLabel: "Italian",
    timezone: "Europe/Rome",
    foundedYear: 2026,
    hasOwnLocationImagery: false,
    // Alex's call on 2026-08-09: the site is finished and the roster is
    // imminent, so the sister-market links go up now rather than waiting for
    // the first approved photographer.
    listedInSiblings: true,
    // Footer links go up now; the concierge holds off until Italy has a
    // roster, so no live lead is sent to an empty catalogue.
    referralsWelcome: false,
    // The operating company is Portuguese and is not registered in Spain, so
    // Stripe Connect onboarding is not available to Spanish photographers.
    // They are paid by bank transfer after the money clears. See docs/SPAIN.md §6.2.
  },
};

function resolve(raw: string | undefined): CountryPack {
  if (raw === "es") return PACKS.es;
  if (raw === "it") return PACKS.it;
  return PACKS.pt;
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
export const isItaly = country.code === "it";

/**
 * Pick a value for the active market.
 *
 * Use this instead of `country.code === "es" ? spanish : portuguese`. That
 * ternary silently resolves to Portugal for every market that is not Spain, so
 * adding Italy put "Getting married in Portugal?" on the Italian homepage, sent
 * the concierge out introducing itself as Photo Portugal, and pointed a dozen
 * other copy blocks at Lisbon — none of which any compiler could see.
 *
 * Here the argument is a full `Record<CountryCode, T>`, so a new country fails
 * the build in every place that needs copy for it.
 */
export function byCountry<T>(choices: Record<CountryCode, T>): T {
  return choices[country.code];
}

/**
 * The other markets in the portfolio, in launch order, never including this
 * one.
 *
 * Two places need it: the footer, so a visitor on the wrong country site can
 * find the right one, and the concierge, which must send an out-of-country
 * request to the sister site by name instead of turning a real booking away.
 * Both used to hardcode "the other one", which only works while there are
 * exactly two.
 */
export const siblingMarkets: CountryPack[] = (["pt", "es", "it"] as const)
  .filter((code) => code !== country.code)
  .map((code) => PACKS[code])
  .filter((pack) => pack.listedInSiblings);

/** The subset the concierge may hand a live booking lead to. */
export const referralMarkets: CountryPack[] = siblingMarkets.filter((p) => p.referralsWelcome);

/**
 * Every market pays photographers through Stripe Connect.
 *
 * Spain briefly shipped a manual IBAN-transfer mode, on the assumption that a
 * Portuguese-registered platform could not onboard Spanish photographers. That
 * assumption was wrong: the platform's own country constrains only the platform
 * account, and a connected account carries its own country, identity and bank
 * details. Verified by creating a real ES connected account from the PT
 * platform key. The manual mode and its IBAN screens were removed rather than
 * left switched off, because a dormant second payout path is exactly the kind
 * of code that drifts out of sync and then fails silently the day it is used.
 */

/**
 * `/it` for a locale this market ships, `""` for English or anything it does
 * not serve.
 *
 * Six Stripe routes carried a hardcoded `["pt","de","es","fr"]` list, written
 * when Portugal was the only market. Italy ships `en/it/de/fr/es`, so an
 * Italian photographer finishing Stripe onboarding was returned to the English
 * dashboard, and a Portuguese locale that Italy does not serve would have been
 * honoured. Read the market's own list instead.
 */
export function localePathPrefix(locale: string | null | undefined): string {
  if (!locale || locale === "en") return "";
  return country.locales.includes(locale) ? `/${locale}` : "";
}

/**
 * The language Stripe should render its own pages in. `"auto"` lets Stripe
 * read the browser, which is the right answer for English and for anything
 * this market does not ship.
 */
export function stripeLocale(locale: string | null | undefined): string {
  return locale && locale !== "en" && country.locales.includes(locale) ? locale : "auto";
}

/** The market's locales minus English — the set that appears as a URL prefix. */
export const prefixedLocales: readonly string[] = country.locales.filter((l) => l !== "en");
