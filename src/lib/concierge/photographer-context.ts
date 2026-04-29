import { query } from "@/lib/db";

export interface ConciergePhotographer {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  rating: number;
  review_count: number;
  is_featured: boolean;
  is_verified: boolean;
  is_founding: boolean;
  locations: string[];
  shoot_types: string[];
  languages: string[];
  min_price: number | null;
  avatar_url: string | null;
  cover_url: string | null;
  sample_portfolio_url: string | null;
  /** Up to 7 portfolio thumbnails for the on-card carousel. Cover is shown first. */
  portfolio_thumbs: string[];
  cover_position_y: number | null;
  last_seen_at: string | null;
  sample_review: { text: string; client_name: string | null } | null;
}

let cache: { rows: ConciergePhotographer[]; fetchedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function loadPhotographersForConcierge(): Promise<ConciergePhotographer[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.rows;

  const rows = await query<{
    id: string; slug: string; name: string; tagline: string | null;
    rating: string; review_count: number; is_featured: boolean; is_verified: boolean; is_founding: boolean;
    locations: string[] | null; shoot_types: string[] | null; languages: string[] | null;
    min_price: string | null; avatar_url: string | null; cover_url: string | null; cover_position_y: number | null;
    sample_portfolio_url: string | null;
    portfolio_thumbs: string[] | null;
    last_seen_at: string | null;
    review_text: string | null; review_client_name: string | null;
  }>(
    `SELECT
       pp.id,
       pp.slug,
       u.name,
       pp.tagline,
       COALESCE(pp.rating, 0)::text AS rating,
       COALESCE(pp.review_count, 0) AS review_count,
       COALESCE(pp.is_featured, FALSE) AS is_featured,
       COALESCE(pp.is_verified, FALSE) AS is_verified,
       COALESCE(pp.is_founding, FALSE) AS is_founding,
       ARRAY(SELECT location_slug FROM photographer_locations WHERE photographer_id = pp.id) AS locations,
       COALESCE(pp.shoot_types, '{}') AS shoot_types,
       COALESCE(pp.languages, '{}') AS languages,
       (SELECT MIN(price)::text FROM packages WHERE photographer_id = pp.id) AS min_price,
       u.avatar_url,
       pp.cover_url,
       pp.cover_position_y,
       (SELECT url FROM portfolio_items WHERE photographer_id = pp.id AND type = 'photo' ORDER BY sort_order, created_at LIMIT 1) AS sample_portfolio_url,
       ARRAY(SELECT url FROM portfolio_items WHERE photographer_id = pp.id AND type = 'photo' ORDER BY sort_order NULLS LAST, created_at LIMIT 7) AS portfolio_thumbs,
       u.last_seen_at::text,
       (SELECT r.text FROM reviews r WHERE r.photographer_id = pp.id AND r.is_approved = TRUE AND r.text IS NOT NULL AND length(r.text) > 30 ORDER BY r.rating DESC, r.created_at DESC LIMIT 1) AS review_text,
       (SELECT COALESCE(r.client_name_override, cu.name) FROM reviews r LEFT JOIN users cu ON cu.id = r.client_id WHERE r.photographer_id = pp.id AND r.is_approved = TRUE AND r.text IS NOT NULL AND length(r.text) > 30 ORDER BY r.rating DESC, r.created_at DESC LIMIT 1) AS review_client_name
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.is_approved = TRUE
       AND COALESCE(pp.is_test, FALSE) = FALSE
       AND COALESCE(u.is_banned, FALSE) = FALSE
     ORDER BY pp.is_featured DESC, pp.is_verified DESC, pp.rating DESC, pp.review_count DESC`
  );

  const photographers: ConciergePhotographer[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    rating: parseFloat(r.rating) || 0,
    review_count: r.review_count,
    is_featured: r.is_featured,
    is_verified: r.is_verified,
    is_founding: r.is_founding,
    locations: r.locations || [],
    shoot_types: r.shoot_types || [],
    languages: r.languages || [],
    min_price: r.min_price ? parseInt(r.min_price) : null,
    avatar_url: r.avatar_url,
    cover_url: r.cover_url,
    cover_position_y: r.cover_position_y,
    sample_portfolio_url: r.sample_portfolio_url,
    portfolio_thumbs: r.portfolio_thumbs || [],
    last_seen_at: r.last_seen_at,
    sample_review: r.review_text ? { text: r.review_text, client_name: r.review_client_name } : null,
  }));

  cache = { rows: photographers, fetchedAt: Date.now() };
  return photographers;
}

// Compact representation for the system prompt — keeps tokens manageable.
// Tier marker is leading so the LLM can see "FEATURED" / "VERIFIED" at a glance
// when ranking. Featured = paid placement and MUST be preferred when relevant
// (see system prompt instruction). The list is already pre-sorted featured-first,
// but explicit markers prevent the model from blindly random-picking.
export function photographersToSystemPromptBlock(list: ConciergePhotographer[]): string {
  const lines = list.map((p) => {
    const tier = p.is_featured ? "[FEATURED]" : p.is_verified ? "[VERIFIED]" : p.is_founding ? "[FOUNDING]" : null;
    const parts = [
      tier,
      `slug=${p.slug}`,
      `name="${p.name}"`,
      `locations=[${p.locations.join(",")}]`,
      `shoot_types=[${p.shoot_types.join(", ")}]`,
      p.languages.length ? `languages=[${p.languages.join(",")}]` : null,
      p.min_price ? `from=€${p.min_price}` : null,
      p.review_count > 0 ? `rating=${p.rating.toFixed(1)} (${p.review_count} reviews)` : `rating=new`,
      p.tagline ? `tagline="${p.tagline.replace(/"/g, "'").slice(0, 120)}"` : null,
    ].filter(Boolean);
    return `- ${parts.join(" | ")}`;
  });
  return lines.join("\n");
}
