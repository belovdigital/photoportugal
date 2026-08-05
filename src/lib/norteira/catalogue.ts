/**
 * Norteira — the agent channel that fronts every market.
 *
 * ChatGPT (and any other MCP client) talks to one endpoint and never learns
 * that Portugal and Spain are separate deployments with separate databases.
 * This file is the only place that knows the mapping.
 *
 * Named after the umbrella brand rather than a country on purpose. The
 * websites are split for local SEO and local brand trust; an MCP endpoint has
 * no organic surface, and a traveller connects the channel BEFORE they have
 * decided which country they are visiting — so one endpoint per market would
 * make the client pick the answer before asking the question. (Working name
 * until 2026-08-06 was "PhotoTravel"; nothing had shipped under it.)
 *
 * Scope is deliberately the blind-booking flow and nothing else: the visitor
 * says where, when and what kind of shoot, pays a fixed all-in price, and we
 * match a photographer afterwards. That removes the one thing an agent cannot
 * be trusted with yet — quoting live per-photographer availability off the
 * calendar sync, where partial data reads as "free" rather than as an error.
 *
 * Destination slugs here MUST resolve through `slugToRegion()` in
 * lib/blind-booking/pricing.ts, otherwise the quote endpoint 404s.
 */

/**
 * The channel's own identity, kept apart from every market's.
 *
 * `endpoint` is a subdomain of the umbrella and NOT a path on a country site,
 * so the published address survives any market being added, renamed or taken
 * down. It proxies to /api/mcp on the Portugal box; that is an implementation
 * detail no client should ever see.
 */
export const CHANNEL = {
  name: "Norteira",
  endpoint: "https://mcp.norteira.com",
  docs: "https://norteira.com/mcp",
  /** Booking attribution. Stored on every row the channel creates. */
  utmSource: "norteira",
} as const;

export type MarketKey = "portugal" | "spain";

export interface Market {
  key: MarketKey;
  /** Public base URL. The MCP route calls each market's own REST API. */
  baseUrl: string;
  brand: string;
  country: string;
  /**
   * Off means the agent never offers or books this country — its
   * destinations are filtered out of every tool. Spain is off until it has
   * an approved roster: taking a booking we cannot match is worse than not
   * appearing in the channel at all. Flip to true to launch it.
   */
  enabled: boolean;
}

export const MARKETS: Record<MarketKey, Market> = {
  portugal: {
    key: "portugal",
    baseUrl: "https://photoportugal.com",
    brand: "Photo Portugal",
    country: "Portugal",
    enabled: true,
  },
  spain: {
    key: "spain",
    baseUrl: "https://photospain.co",
    brand: "Photo Spain",
    country: "Spain",
    enabled: false,
  },
};

export function enabledMarkets(): Market[] {
  return Object.values(MARKETS).filter((m) => m.enabled);
}

export interface Destination {
  /** Slug passed straight to the pricing endpoint as `region`. */
  slug: string;
  name: string;
  market: MarketKey;
  /** Coarse grouping, shown to the model so it can offer nearby alternatives. */
  area: string;
}

/**
 * Curated rather than generated. Every slug below is a key in the pricing
 * maps; the point of curating is that the model should offer places a
 * traveller would actually name, not internal region buckets.
 */
export const DESTINATIONS: Destination[] = [
  // ── Portugal ──────────────────────────────────────────────────────────
  { slug: "lisbon", name: "Lisbon", market: "portugal", area: "Greater Lisbon" },
  { slug: "sintra", name: "Sintra", market: "portugal", area: "Greater Lisbon" },
  { slug: "cascais", name: "Cascais", market: "portugal", area: "Greater Lisbon" },
  { slug: "ericeira", name: "Ericeira", market: "portugal", area: "Greater Lisbon" },
  { slug: "comporta", name: "Comporta", market: "portugal", area: "Greater Lisbon" },
  { slug: "setubal", name: "Setúbal", market: "portugal", area: "Greater Lisbon" },
  { slug: "porto", name: "Porto", market: "portugal", area: "Northern Portugal" },
  { slug: "braga", name: "Braga", market: "portugal", area: "Northern Portugal" },
  { slug: "guimaraes", name: "Guimarães", market: "portugal", area: "Northern Portugal" },
  { slug: "douro-valley", name: "Douro Valley", market: "portugal", area: "Northern Portugal" },
  { slug: "aveiro", name: "Aveiro", market: "portugal", area: "Central Portugal" },
  { slug: "coimbra", name: "Coimbra", market: "portugal", area: "Central Portugal" },
  { slug: "obidos", name: "Óbidos", market: "portugal", area: "Central Portugal" },
  { slug: "nazare", name: "Nazaré", market: "portugal", area: "Central Portugal" },
  { slug: "alentejo", name: "Alentejo", market: "portugal", area: "Alentejo" },
  { slug: "evora", name: "Évora", market: "portugal", area: "Alentejo" },
  // Travellers name the Algarve far more often than any town in it, so the
  // region has to be bookable in its own right and not only via Lagos or Faro.
  { slug: "algarve", name: "Algarve", market: "portugal", area: "Algarve" },
  { slug: "lagos", name: "Lagos", market: "portugal", area: "Algarve" },
  { slug: "albufeira", name: "Albufeira", market: "portugal", area: "Algarve" },
  { slug: "faro", name: "Faro", market: "portugal", area: "Algarve" },
  { slug: "tavira", name: "Tavira", market: "portugal", area: "Algarve" },
  { slug: "madeira", name: "Madeira", market: "portugal", area: "Madeira" },
  { slug: "azores", name: "Azores", market: "portugal", area: "Azores" },
  { slug: "sao-miguel", name: "São Miguel", market: "portugal", area: "Azores" },

  // ── Spain ─────────────────────────────────────────────────────────────
  { slug: "barcelona", name: "Barcelona", market: "spain", area: "Catalonia" },
  { slug: "girona", name: "Girona", market: "spain", area: "Catalonia" },
  { slug: "sitges", name: "Sitges", market: "spain", area: "Catalonia" },
  { slug: "costa-brava", name: "Costa Brava", market: "spain", area: "Catalonia" },
  { slug: "madrid", name: "Madrid", market: "spain", area: "Madrid region" },
  { slug: "toledo", name: "Toledo", market: "spain", area: "Madrid region" },
  { slug: "segovia", name: "Segovia", market: "spain", area: "Madrid region" },
  { slug: "seville", name: "Seville", market: "spain", area: "Andalusia" },
  { slug: "granada", name: "Granada", market: "spain", area: "Andalusia" },
  { slug: "cordoba", name: "Córdoba", market: "spain", area: "Andalusia" },
  { slug: "malaga", name: "Málaga", market: "spain", area: "Andalusia" },
  { slug: "marbella", name: "Marbella", market: "spain", area: "Andalusia" },
  { slug: "ronda", name: "Ronda", market: "spain", area: "Andalusia" },
  { slug: "cadiz", name: "Cádiz", market: "spain", area: "Andalusia" },
  { slug: "mallorca", name: "Mallorca", market: "spain", area: "Balearic Islands" },
  { slug: "ibiza", name: "Ibiza", market: "spain", area: "Balearic Islands" },
  { slug: "menorca", name: "Menorca", market: "spain", area: "Balearic Islands" },
  { slug: "tenerife", name: "Tenerife", market: "spain", area: "Canary Islands" },
  { slug: "gran-canaria", name: "Gran Canaria", market: "spain", area: "Canary Islands" },
  { slug: "lanzarote", name: "Lanzarote", market: "spain", area: "Canary Islands" },
  { slug: "valencia", name: "Valencia", market: "spain", area: "Valencia region" },
  { slug: "san-sebastian", name: "San Sebastián", market: "spain", area: "Basque Country" },
  { slug: "bilbao", name: "Bilbao", market: "spain", area: "Basque Country" },
  { slug: "santiago-de-compostela", name: "Santiago de Compostela", market: "spain", area: "Galicia" },
];

const BY_SLUG = new Map(DESTINATIONS.map((d) => [d.slug, d]));

/** Only ever returns a destination in a live market — see Market.enabled. */
export function findDestination(slug: string): Destination | null {
  const d = BY_SLUG.get(slug.trim().toLowerCase());
  if (!d || !MARKETS[d.market].enabled) return null;
  return d;
}

export function bookableDestinations(): Destination[] {
  return DESTINATIONS.filter((d) => MARKETS[d.market].enabled);
}

/** Mirrors the `occasion` column in region_pricing. */
export const OCCASIONS = [
  "couples",
  "family",
  "solo",
  "engagement",
  "proposal",
  "honeymoon",
  "anniversary",
  "birthday",
  "maternity",
  "elopement",
  "vacation",
  "other",
] as const;

export type Occasion = (typeof OCCASIONS)[number];

export const DURATIONS = [60, 120, 180] as const;

/** Locales the confirmation email and checkout page are available in. */
export const LANGUAGES = ["en", "es", "pt", "de", "fr"] as const;
