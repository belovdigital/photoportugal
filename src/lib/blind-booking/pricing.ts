import { queryOne } from "@/lib/db";

// Canonical region slugs used in `region_pricing`. Concierge LLM emits
// a location slug (city/island), which we collapse into one of these
// 7 buckets before pricing. Centralised here so adding a new region
// is a one-line change.
export type Region =
  // Portugal
  | "greater-lisbon"
  | "northern-portugal"
  | "central-portugal"
  | "alentejo"
  | "algarve"
  | "madeira"
  | "azores"
  // Spain
  | "catalonia"
  | "madrid-region"
  | "andalusia"
  | "balearic-islands"
  | "canary-islands"
  | "valencia-region"
  | "basque-country"
  | "galicia"
  // Italy
  | "lazio"
  | "tuscany"
  | "veneto"
  | "lombardy"
  | "campania"
  | "sicily"
  | "liguria"
  | "puglia";

// Single source of truth — every slug (canonical region, tree-region,
// city, island, group, legacy alias) maps to one of the 7 canonical
// pricing regions. Used by both the price endpoint and the accept
// endpoint to resolve any user-picked slug to a billable region.
const SLUG_TO_REGION: Record<string, Region> = {
  // Canonical regions (identity).
  "greater-lisbon": "greater-lisbon",
  "northern-portugal": "northern-portugal",
  "central-portugal": "central-portugal",
  "alentejo": "alentejo",
  "algarve": "algarve",
  "madeira": "madeira",
  "azores": "azores",
  // location-hierarchy.ts region/group slugs.
  "lisbon-region": "greater-lisbon",
  "porto-north": "northern-portugal",
  "azores-eastern-group": "azores",
  "azores-central-group": "azores",
  "azores-western-group": "azores",
  // Greater Lisbon cities/spots.
  "lisbon": "greater-lisbon",
  "sintra": "greater-lisbon",
  "cascais": "greater-lisbon",
  "caparica": "greater-lisbon",
  "ericeira": "greater-lisbon",
  "almada": "greater-lisbon",
  "setubal": "greater-lisbon",
  "comporta": "greater-lisbon",
  "sesimbra": "greater-lisbon",
  "arrabida": "greater-lisbon",
  // Northern Portugal cities/regions.
  "porto": "northern-portugal",
  "braga": "northern-portugal",
  "guimaraes": "northern-portugal",
  "douro-valley": "northern-portugal",
  "douro": "northern-portugal",
  "geres": "northern-portugal",
  // Central Portugal cities (aveiro lives here per the hierarchy tree).
  "aveiro": "central-portugal",
  "coimbra": "central-portugal",
  "nazare": "central-portugal",
  "obidos": "central-portugal",
  "tomar": "central-portugal",
  "peniche": "central-portugal",
  // Alentejo cities.
  "evora": "alentejo",
  // Algarve cities.
  "lagos": "algarve",
  "tavira": "algarve",
  "portimao": "algarve",
  "albufeira": "algarve",
  "faro": "algarve",
  "vilamoura": "algarve",
  // Madeira.
  "funchal": "madeira",
  // Azores islands + cities.
  "sao-miguel": "azores",
  "ponta-delgada": "azores",
  "santa-maria": "azores",
  "terceira": "azores",
  "graciosa": "azores",
  "sao-jorge": "azores",
  "pico": "azores",
  "faial": "azores",
  "flores": "azores",
  "corvo": "azores",
};


// Spain. Same shape as the Portuguese table above: every tree node, city and
// island resolves to one billable region. Without these, Quick Booking in Spain
// fell through to the null branch and could not price anything.
const ES_SLUG_TO_REGION: Record<string, Region> = {
  catalonia: "catalonia",
  barcelona: "catalonia",
  sitges: "catalonia",
  girona: "catalonia",
  "costa-brava": "catalonia",

  "madrid-region": "madrid-region",
  madrid: "madrid-region",
  toledo: "madrid-region",
  segovia: "madrid-region",

  andalusia: "andalusia",
  seville: "andalusia",
  granada: "andalusia",
  malaga: "andalusia",
  marbella: "andalusia",
  ronda: "andalusia",
  cordoba: "andalusia",
  cadiz: "andalusia",

  "balearic-islands": "balearic-islands",
  mallorca: "balearic-islands",
  ibiza: "balearic-islands",
  menorca: "balearic-islands",

  "canary-islands": "canary-islands",
  tenerife: "canary-islands",
  "gran-canaria": "canary-islands",
  lanzarote: "canary-islands",

  "valencia-region": "valencia-region",
  valencia: "valencia-region",

  "basque-country": "basque-country",
  "san-sebastian": "basque-country",
  bilbao: "basque-country",

  galicia: "galicia",
  "santiago-de-compostela": "galicia",
};

// Italy. Same shape again: every city, coast and island a visitor can pick
// resolves to one billable region, so Quick Booking can quote from the day the
// market opens instead of answering 404 the way Spain did.
const IT_SLUG_TO_REGION: Record<string, Region> = {
  lazio: "lazio",
  rome: "lazio",
  vatican: "lazio",
  tivoli: "lazio",

  tuscany: "tuscany",
  florence: "tuscany",
  siena: "tuscany",
  pisa: "tuscany",
  "val-dorcia": "tuscany",
  lucca: "tuscany",
  "san-gimignano": "tuscany",

  veneto: "veneto",
  venice: "veneto",
  verona: "veneto",
  "lake-garda": "veneto",
  padua: "veneto",

  lombardy: "lombardy",
  milan: "lombardy",
  "lake-como": "lombardy",
  bergamo: "lombardy",

  campania: "campania",
  naples: "campania",
  "amalfi-coast": "campania",
  amalfi: "campania",
  positano: "campania",
  ravello: "campania",
  sorrento: "campania",
  capri: "campania",
  pompeii: "campania",

  sicily: "sicily",
  palermo: "sicily",
  taormina: "sicily",
  catania: "sicily",
  syracuse: "sicily",

  liguria: "liguria",
  "cinque-terre": "liguria",
  portofino: "liguria",
  genoa: "liguria",

  puglia: "puglia",
  bari: "puglia",
  lecce: "puglia",
  alberobello: "puglia",
  polignano: "puglia",
};

/** Canonical billable regions per market. The nightly seed cron walks these —
 *  it used to carry its own hardcoded Portuguese list, so on the Spanish
 *  instance no Spanish region ever got a price row and Quick Booking answered
 *  404 "No pricing available" for every Spanish destination. Deriving both
 *  lists from the mapping tables above keeps the seed and the lookup honest:
 *  a region that can be resolved is a region that gets priced. */
export const PT_REGIONS: Region[] = [
  "greater-lisbon", "northern-portugal", "central-portugal",
  "alentejo", "algarve", "madeira", "azores",
];

export const ES_REGIONS: Region[] = [
  "catalonia", "madrid-region", "andalusia", "balearic-islands",
  "canary-islands", "valencia-region", "basque-country", "galicia",
];

export const IT_REGIONS: Region[] = [
  "lazio", "tuscany", "veneto", "lombardy",
  "campania", "sicily", "liguria", "puglia",
];

export function regionsForCountry(code: string): Region[] {
  if (code === "es") return ES_REGIONS;
  if (code === "it") return IT_REGIONS;
  return PT_REGIONS;
}

export function slugToRegion(slug: string): Region | null {
  const es = ES_SLUG_TO_REGION[slug];
  if (es) return es;
  const it = IT_SLUG_TO_REGION[slug];
  if (it) return it;
  const norm = String(slug || "").trim().toLowerCase();
  if (!norm) return null;
  return SLUG_TO_REGION[norm] ?? null;
}

// Coerce arbitrary duration to one of the 3 priced brackets. We don't
// interpolate prices between brackets — the seed only has 60/120/180.
export function durationBracket(minutes: number): 60 | 120 | 180 {
  if (minutes <= 75) return 60;
  if (minutes <= 150) return 120;
  return 180;
}

// In-process price cache. region_pricing changes nightly via the
// refresh cron; 1h TTL keeps it cheap without surprising staleness.
const CACHE_TTL_MS = 60 * 60 * 1000;
const priceCache = new Map<string, { value: PriceLookup; expiresAt: number }>();

export interface PriceLookup {
  region: Region;
  occasion: string;
  duration_minutes: number;
  /** CLIENT-INCLUSIVE price (summer super-offer, 2026-07-02): this is the
   *  ALL-IN number the visitor pays — €279/€465/€649 for 60/120/180 min.
   *  It is NOT the photographer base. Derive the base with
   *  blindBaseFromTotal(): base = total − 15% platform cut, then the
   *  standard commission applies to that base at assign time.
   *  (Before 2026-07-02 this column held the photographer BASE and the
   *  client paid base × 1.15 — €299 base / €343.85 all-in.) */
  price_eur: number;
  sample_size: number;
}

/** Pre-offer all-in totals (base €299/€500/€700 × 1.15). Defined in
 *  ./compare-at so the client components that render it do not pull this
 *  module — and with it `pg` — into the browser bundle. */
export { BLIND_COMPARE_AT_EUR } from "./compare-at";

/** 15%-of-total platform service cut, exact to cents. */
export function blindServiceFeeFromTotal(totalEur: number): number {
  return Math.round(totalEur * 0.15 * 100) / 100;
}

/** Photographer BASE from the client-inclusive total: total − 15% cut.
 *  €279 → €237.15 base; the photographer's STANDARD plan commission then
 *  applies to that base at assign time (premium 10% → €213.43, pro 15% →
 *  €201.58, free 20% → €189.72). */
export function blindBaseFromTotal(totalEur: number): number {
  return Math.round((totalEur - blindServiceFeeFromTotal(totalEur)) * 100) / 100;
}

export async function lookupBlindPrice(
  region: Region | string,
  occasion: string,
  durationMinutes: number
): Promise<PriceLookup | null> {
  const regionSlug = String(region || "").toLowerCase();
  const occSlug = String(occasion || "").toLowerCase();
  const bracket = durationBracket(durationMinutes);
  const cacheKey = `${regionSlug}:${occSlug}:${bracket}`;
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await queryOne<{
    region: string;
    occasion: string;
    duration_minutes: number;
    price_eur: number;
    sample_size: number;
  }>(
    `SELECT region, occasion, duration_minutes, price_eur, sample_size
       FROM region_pricing
      WHERE region = $1 AND occasion = $2 AND duration_minutes = $3
      LIMIT 1`,
    [regionSlug, occSlug, bracket]
  );

  if (!row) return null;
  const value: PriceLookup = {
    region: row.region as Region,
    occasion: row.occasion,
    duration_minutes: row.duration_minutes,
    price_eur: row.price_eur,
    sample_size: row.sample_size,
  };
  priceCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

// Resolve a slug-or-region to a priced offer in one call. Returns null
// when the slug doesn't map to a known region OR there's no pricing row.
export async function priceForSlug(
  slug: string,
  occasion: string,
  durationMinutes: number
): Promise<PriceLookup | null> {
  const region = slugToRegion(slug);
  if (!region) return null;
  return lookupBlindPrice(region, occasion, durationMinutes);
}

export function invalidatePriceCache(): void {
  priceCache.clear();
}
