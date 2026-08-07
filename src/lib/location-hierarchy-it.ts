import { locations } from "@/lib/locations-data";
import type { LocationNode } from "./location-hierarchy";

/**
 * Italian location tree.
 *
 * Hand-written, NOT generated — the Spanish tree taught that lesson: running a
 * place-name substitution over another country's tree rewrites the display
 * names and leaves the slugs foreign, and nothing errors. Every consumer that
 * resolves a node by slug just comes back empty (empty location picker, no
 * coverage checkboxes, no Quick Booking destinations, a concierge that cannot
 * match a city), which is invisible until someone tries to book.
 *
 * Slugs here MUST match `locations-data-it.ts` exactly, and every region slug
 * MUST exist in `blind-booking/pricing.ts` — a destination that cannot be
 * priced must not be offered.
 */

const legacyLocationSlugs = new Set(locations.map((location) => location.slug));

function legacy(slug: string): string[] {
  return legacyLocationSlugs.has(slug) ? [slug] : [];
}

export const LOCATION_TREE_IT: LocationNode[] = [
  {
    slug: "lazio",
    name: "Rome & Lazio",
    type: "region",
    children: [
      { slug: "rome", name: "Rome", type: "city", legacySlugs: legacy("rome") },
    ],
  },
  {
    slug: "tuscany",
    name: "Tuscany",
    type: "region",
    children: [
      { slug: "florence", name: "Florence", type: "city", legacySlugs: legacy("florence") },
      { slug: "siena", name: "Siena", type: "city", legacySlugs: legacy("siena") },
      { slug: "val-dorcia", name: "Val d'Orcia", type: "region", legacySlugs: legacy("val-dorcia") },
      { slug: "pisa", name: "Pisa", type: "city", legacySlugs: legacy("pisa") },
      { slug: "lucca", name: "Lucca", type: "city", legacySlugs: legacy("lucca") },
    ],
  },
  {
    slug: "veneto",
    name: "Venice & Veneto",
    type: "region",
    children: [
      { slug: "venice", name: "Venice", type: "city", legacySlugs: legacy("venice") },
      { slug: "verona", name: "Verona", type: "city", legacySlugs: legacy("verona") },
      { slug: "lake-garda", name: "Lake Garda", type: "region", legacySlugs: legacy("lake-garda") },
    ],
  },
  {
    slug: "lombardy",
    name: "Milan & the Lakes",
    type: "region",
    children: [
      { slug: "milan", name: "Milan", type: "city", legacySlugs: legacy("milan") },
      { slug: "lake-como", name: "Lake Como", type: "region", legacySlugs: legacy("lake-como") },
    ],
  },
  {
    slug: "campania",
    name: "Amalfi Coast & Naples",
    type: "region",
    children: [
      { slug: "naples", name: "Naples", type: "city", legacySlugs: legacy("naples") },
      { slug: "amalfi-coast", name: "Amalfi Coast", type: "region", legacySlugs: legacy("amalfi-coast") },
      { slug: "positano", name: "Positano", type: "city", legacySlugs: legacy("positano") },
      { slug: "sorrento", name: "Sorrento", type: "city", legacySlugs: legacy("sorrento") },
      { slug: "capri", name: "Capri", type: "island", legacySlugs: legacy("capri") },
      { slug: "ravello", name: "Ravello", type: "city", legacySlugs: legacy("ravello") },
    ],
  },
  {
    slug: "sicily",
    name: "Sicily",
    type: "region",
    children: [
      { slug: "taormina", name: "Taormina", type: "city", legacySlugs: legacy("taormina") },
      { slug: "palermo", name: "Palermo", type: "city", legacySlugs: legacy("palermo") },
      { slug: "syracuse", name: "Syracuse", type: "city", legacySlugs: legacy("syracuse") },
    ],
  },
  {
    slug: "liguria",
    name: "Cinque Terre & Liguria",
    type: "region",
    children: [
      { slug: "cinque-terre", name: "Cinque Terre", type: "region", legacySlugs: legacy("cinque-terre") },
      { slug: "portofino", name: "Portofino", type: "city", legacySlugs: legacy("portofino") },
    ],
  },
  {
    slug: "puglia",
    name: "Puglia",
    type: "region",
    children: [
      { slug: "lecce", name: "Lecce", type: "city", legacySlugs: legacy("lecce") },
      { slug: "alberobello", name: "Alberobello", type: "city", legacySlugs: legacy("alberobello") },
    ],
  },
];
