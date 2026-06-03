import { queryOne } from "@/lib/db";

// Canonical region slugs used in `region_pricing`. Concierge LLM emits
// a location slug (city/island), which we collapse into one of these
// 7 buckets before pricing. Centralised here so adding a new region
// is a one-line change.
export type Region =
  | "greater-lisbon"
  | "northern-portugal"
  | "central-portugal"
  | "alentejo"
  | "algarve"
  | "madeira"
  | "azores";

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

export function slugToRegion(slug: string): Region | null {
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
  price_eur: number;
  sample_size: number;
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
