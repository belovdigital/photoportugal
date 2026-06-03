// Pick relevant portfolio photos for a package, using existing
// metadata on portfolio_items (location_slug, shoot_type) — no AI.
// 80%+ of our portfolio photos are already tagged, so a keyword
// match against the package name/description is enough to surface
// "Perfect Couple Session" couple shots, "Golden Hour Lisbon" Lisbon
// shots, etc.

import { locations } from "./locations-data";

// Canonical shoot type buckets. Each bucket has a set of patterns
// (lowercase, regex-ready) that can appear in either the package name
// or in `portfolio_items.shoot_type` (which is mixed case). Order
// matters — first match wins for tie-breaking.
const SHOOT_BUCKETS: Array<{ canonical: string; patterns: RegExp }> = [
  { canonical: "wedding", patterns: /\b(wedding|elopement|nuptial)\b/i },
  { canonical: "engagement", patterns: /\b(engagement|engaged|pre.?wedding)\b/i },
  { canonical: "couples", patterns: /\b(couple|couples|romantic|date|anniversary|engagement|love)\b/i },
  { canonical: "honeymoon", patterns: /\b(honeymoon)\b/i },
  { canonical: "proposal", patterns: /\b(proposal|propose)\b/i },
  { canonical: "family", patterns: /\b(family|families|kids|children|parents|generations)\b/i },
  { canonical: "maternity", patterns: /\b(maternity|pregnan|bump|expecting)\b/i },
  { canonical: "solo", patterns: /\b(solo|portrait|individual|personal|professional|headshot|studio)\b/i },
  { canonical: "friends", patterns: /\b(friends|bachelorette|bachelor|hen|stag|group)\b/i },
  { canonical: "birthday", patterns: /\b(birthday)\b/i },
];

export function inferPackageTags(name: string, description: string | null): {
  shootTypeKeywords: string[];
  locationSlugs: string[];
} {
  const text = `${name} ${description || ""}`.toLowerCase();

  // Match every shoot bucket whose pattern hits — the SQL side will
  // fan these out into LOWER(shoot_type) keyword matches.
  const shootTypeKeywords: string[] = [];
  for (const bucket of SHOOT_BUCKETS) {
    if (bucket.patterns.test(text)) shootTypeKeywords.push(bucket.canonical);
  }

  // Match against the static locations catalog. Slug AND name both
  // checked — "Algarve" in a package title hits the algarve location.
  const locationSlugs: string[] = [];
  for (const loc of locations) {
    const slugWords = loc.slug.split("-").join(" ");
    const nameLc = loc.name.toLowerCase();
    if (text.includes(slugWords) || text.includes(nameLc)) {
      locationSlugs.push(loc.slug);
    }
  }

  return { shootTypeKeywords, locationSlugs };
}

// Title-case a location slug for display when it's not in the static
// catalog (e.g. "caparica", "ericeira") and no DB row in `locations`.
// Single-word slugs become "Caparica"; multi-word "costa-da-caparica"
// become "Costa Da Caparica".
export function locationDisplayName(slug: string): string {
  const fromCatalog = locations.find((l) => l.slug === slug);
  if (fromCatalog) return fromCatalog.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
