import type { PhotographerProfile, Location, Package } from "@/types";

/**
 * Adapter for pages that don't have the full photographer record but want
 * to render the rich `PhotographerCard`. Most listing pages (locations,
 * occasions, photoshoots, spots, LP) only fetch slug/name/cover/rating-level
 * data — this fills in the rest with sensible empty defaults so the card
 * still works without three extra JOINs.
 *
 * Conventions:
 *  - `min_price` from a single SELECT is reshaped into a one-package array,
 *    because `PhotographerCard` derives its "From €X" line from `packages`.
 *  - `locations` should be an array of `{slug, name}`. Pages that only have
 *    a comma-joined string can pass `[]` and the location-tags row will be
 *    skipped gracefully.
 */
export interface MinimalCardData {
  id?: string;
  slug: string;
  name: string;
  tagline: string | null;
  bio?: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y?: number | null;
  portfolio_thumbs?: string[] | null;
  is_featured?: boolean;
  is_verified?: boolean;
  is_founding?: boolean;
  plan?: string | null;
  rating: number | string;
  review_count: number;
  session_count?: number;
  min_price?: number | string | null;
  /** Either a `[{slug, name}]` array OR a comma-joined string ("Lisbon, Cascais"). */
  locations?: { slug: string; name: string }[] | string | null;
  shoot_types?: string[] | null;
  languages?: string[] | null;
  experience_years?: number | null;
  last_active_at?: string | null;
  avg_response_minutes?: number | null;
}

export function adaptToPhotographerProfile(d: MinimalCardData): PhotographerProfile {
  const rawLocs = Array.isArray(d.locations)
    ? d.locations
    : typeof d.locations === "string" && d.locations
      ? d.locations.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), name }))
      : [];
  // PhotographerCard only reads slug + name; pad the rest with empty values so
  // the strict `Location` shape is satisfied without touching the original type.
  const locArr: Location[] = rawLocs.map((l) => ({
    id: "",
    slug: l.slug,
    name: l.name,
    region: "",
    description: "",
    long_description: "",
    cover_image: "",
    gallery_images: [],
    lat: 0,
    lng: 0,
    photographer_count: 0,
  } as unknown as Location));
  const minPrice = d.min_price != null ? Number(d.min_price) : null;
  const packages: Package[] = minPrice && minPrice > 0
    ? [{ id: `min-${d.slug}`, name: "from", description: "", duration_minutes: 0, num_photos: 0, price: minPrice, is_popular: false, is_public: true, features: [] }]
    : [];
  return {
    id: d.id ?? d.slug,
    user_id: "",
    slug: d.slug,
    name: d.name,
    tagline: d.tagline ?? "",
    bio: d.bio ?? "",
    avatar_url: d.avatar_url,
    cover_url: d.cover_url,
    cover_position_y: d.cover_position_y ?? 50,
    languages: d.languages ?? [],
    hourly_rate: 0,
    currency: "EUR",
    locations: locArr,
    packages,
    shoot_types: d.shoot_types ?? [],
    experience_years: d.experience_years ?? 0,
    is_verified: !!d.is_verified,
    is_featured: !!d.is_featured,
    is_founding: !!d.is_founding,
    plan: (d.plan === "pro" || d.plan === "premium") ? d.plan : "free",
    rating: Number(d.rating) || 0,
    review_count: d.review_count ?? 0,
    session_count: d.session_count ?? 0,
    created_at: "",
    last_seen_at: d.last_active_at ?? null,
    avg_response_minutes: d.avg_response_minutes ?? null,
    portfolio_thumbs: d.portfolio_thumbs ?? null,
  };
}
