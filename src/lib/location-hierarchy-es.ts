import { locations } from "@/lib/locations-data";
import type { LocationNode } from "./location-hierarchy";

/**
 * Spanish location tree.
 *
 * Hand-written, NOT generated. The first attempt ran the Portuguese tree
 * through the place-name substitution, which rewrote display names but left
 * every slug Portuguese (`lisbon`, `sintra`, `cascais`). The result had zero
 * slugs in common with `locations-data-es.ts`, so every consumer that resolves
 * a node by slug came back empty: the location picker showed "No locations
 * found", the photographer coverage step had nothing to tick, Quick Booking
 * had no destinations, and the concierge could not match a city.
 *
 * Slugs here MUST match `locations-data-es.ts` exactly. A mismatch is silently
 * invisible rather than an error, which is why it survived a whole deploy.
 */

const legacyLocationSlugs = new Set(locations.map((location) => location.slug));

function legacy(slug: string): string[] {
  return legacyLocationSlugs.has(slug) ? [slug] : [];
}

export const LOCATION_TREE_ES: LocationNode[] = [
  {
    slug: "catalonia",
    name: "Catalonia",
    type: "region",
    children: [
      { slug: "barcelona", name: "Barcelona", type: "city", legacySlugs: legacy("barcelona") },
      { slug: "sitges", name: "Sitges", type: "city", legacySlugs: legacy("sitges") },
      { slug: "girona", name: "Girona", type: "city", legacySlugs: legacy("girona") },
      { slug: "costa-brava", name: "Costa Brava", type: "region", legacySlugs: legacy("costa-brava") },
    ],
  },
  {
    slug: "madrid-region",
    name: "Madrid & Central Spain",
    type: "region",
    children: [
      { slug: "madrid", name: "Madrid", type: "city", legacySlugs: legacy("madrid") },
      { slug: "toledo", name: "Toledo", type: "city", legacySlugs: legacy("toledo") },
      { slug: "segovia", name: "Segovia", type: "city", legacySlugs: legacy("segovia") },
    ],
  },
  {
    slug: "andalusia",
    name: "Andalusia",
    type: "region",
    children: [
      { slug: "seville", name: "Seville", type: "city", legacySlugs: legacy("seville") },
      { slug: "granada", name: "Granada", type: "city", legacySlugs: legacy("granada") },
      { slug: "malaga", name: "Málaga", type: "city", legacySlugs: legacy("malaga") },
      { slug: "marbella", name: "Marbella", type: "city", legacySlugs: legacy("marbella") },
      { slug: "ronda", name: "Ronda", type: "city", legacySlugs: legacy("ronda") },
      { slug: "cordoba", name: "Córdoba", type: "city", legacySlugs: legacy("cordoba") },
      { slug: "cadiz", name: "Cádiz", type: "city", legacySlugs: legacy("cadiz") },
    ],
  },
  {
    slug: "balearic-islands",
    name: "Balearic Islands",
    type: "group",
    children: [
      { slug: "mallorca", name: "Mallorca", type: "island", legacySlugs: legacy("mallorca") },
      { slug: "ibiza", name: "Ibiza", type: "island", legacySlugs: legacy("ibiza") },
      { slug: "menorca", name: "Menorca", type: "island", legacySlugs: legacy("menorca") },
    ],
  },
  {
    slug: "canary-islands",
    name: "Canary Islands",
    type: "group",
    children: [
      { slug: "tenerife", name: "Tenerife", type: "island", legacySlugs: legacy("tenerife") },
      { slug: "gran-canaria", name: "Gran Canaria", type: "island", legacySlugs: legacy("gran-canaria") },
      { slug: "lanzarote", name: "Lanzarote", type: "island", legacySlugs: legacy("lanzarote") },
    ],
  },
  {
    slug: "valencia-region",
    name: "Valencian Community",
    type: "region",
    children: [
      { slug: "valencia", name: "Valencia", type: "city", legacySlugs: legacy("valencia") },
    ],
  },
  {
    slug: "basque-country",
    name: "Basque Country",
    type: "region",
    children: [
      { slug: "san-sebastian", name: "San Sebastián", type: "city", legacySlugs: legacy("san-sebastian") },
      { slug: "bilbao", name: "Bilbao", type: "city", legacySlugs: legacy("bilbao") },
    ],
  },
  {
    slug: "galicia",
    name: "Galicia",
    type: "region",
    children: [
      {
        slug: "santiago-de-compostela",
        name: "Santiago de Compostela",
        type: "city",
        legacySlugs: legacy("santiago-de-compostela"),
      },
    ],
  },
];
