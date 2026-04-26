import { query } from "@/lib/db";
import { unstable_cache } from "next/cache";

export interface PublicReview {
  id: string;
  text: string;
  rating: number;
  created_at: string;
  client_name: string | null;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  photographer_avatar: string | null;
  photo_url: string | null;
  client_country: string | null;
}

interface DbRow {
  id: string;
  text: string;
  rating: number;
  created_at: string;
  client_name_override: string | null;
  client_db_name: string | null;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  photographer_avatar: string | null;
  photo_url: string | null;
  client_country: string | null;
}

function mapRow(r: DbRow): PublicReview {
  return {
    id: r.id,
    text: r.text,
    rating: r.rating,
    created_at: r.created_at,
    client_name: r.client_name_override || r.client_db_name || null,
    photographer_id: r.photographer_id,
    photographer_name: r.photographer_name,
    photographer_slug: r.photographer_slug,
    photographer_avatar: r.photographer_avatar,
    photo_url: r.photo_url,
    client_country: r.client_country,
  };
}

// Allowed locale columns on the reviews table (text_pt, text_de, text_es, text_fr).
// Fall back to source `text` when locale is "en" or unknown.
const REVIEW_LOCALES = new Set(["pt", "de", "es", "fr"]);
function localeText(locale?: string): string {
  if (locale && REVIEW_LOCALES.has(locale)) return `COALESCE(r.text_${locale}, r.text)`;
  return "r.text";
}

function baseSelect(locale?: string): string {
  return `
    r.id, ${localeText(locale)} as text, r.rating, r.created_at,
    r.client_name_override,
    cu.name as client_db_name,
    pp.id as photographer_id,
    pu.name as photographer_name,
    pp.slug as photographer_slug,
    pu.avatar_url as photographer_avatar,
    (SELECT rp.url FROM review_photos rp WHERE rp.review_id = r.id AND rp.is_public = TRUE ORDER BY rp.created_at LIMIT 1) as photo_url,
    COALESCE(r.client_country_override, (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = r.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at ASC LIMIT 1)) as client_country
  `;
}

const BASE_JOINS = `
  FROM reviews r
  JOIN photographer_profiles pp ON pp.id = r.photographer_id
  JOIN users pu ON pu.id = pp.user_id
  LEFT JOIN users cu ON cu.id = r.client_id
`;

const WHERE_APPROVED = `
  r.is_approved = TRUE AND pp.is_approved = TRUE
  AND r.text IS NOT NULL AND LENGTH(r.text) >= 80
`;

/**
 * Aggregate rating + count across all approved reviews (approved photographers only).
 * Cached for 1 week — review totals change slowly, no need to hit the DB every request.
 */
export const getSiteReviewStats = unstable_cache(
  async (): Promise<{ count: number; avgRating: number }> => {
    try {
      const rows = await query<{ count: string; avg_rating: string | null }>(
        `SELECT COUNT(*)::text as count, ROUND(AVG(r.rating)::numeric, 1)::text as avg_rating
         FROM reviews r
         JOIN photographer_profiles pp ON pp.id = r.photographer_id
         WHERE r.is_approved = TRUE AND pp.is_approved = TRUE`
      );
      const r = rows[0];
      return {
        count: Number(r?.count ?? 0),
        avgRating: r?.avg_rating ? Number(r.avg_rating) : 5.0,
      };
    } catch {
      return { count: 0, avgRating: 5.0 };
    }
  },
  ["site-review-stats"],
  { revalidate: 3600, tags: ["site-review-stats"] }
);

/**
 * Homepage reviews — fully random, at most 2 per photographer for variety.
 * No prioritisation of reviews with photos — each review competes equally.
 */
export async function getHomepageReviews(limit = 9, locale?: string): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${baseSelect(locale)},
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY RANDOM()) as rn_per_photographer
         ${BASE_JOINS}
         WHERE ${WHERE_APPROVED}
       )
       SELECT id, text, rating, created_at, client_name_override, client_db_name,
              photographer_id, photographer_name, photographer_slug, photographer_avatar,
              photo_url, client_country
       FROM ranked
       WHERE rn_per_photographer <= 2
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Reviews for a single photographer — used on /book/<slug> sidebar etc.
 */
export async function getReviewsForPhotographer(photographerId: string, limit = 3, locale?: string): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `SELECT ${baseSelect(locale)}
       ${BASE_JOINS}
       WHERE ${WHERE_APPROVED} AND pp.id = $1
       ORDER BY photo_url IS NULL, r.created_at DESC
       LIMIT $2`,
      [photographerId, limit]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Reviews from photographers who work in a specific location.
 */
export async function getReviewsForLocation(locationSlug: string, limit = 6, locale?: string): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${baseSelect(locale)},
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY LENGTH(COALESCE(r.text, '')) DESC) as rn_per_photographer
         ${BASE_JOINS}
         JOIN photographer_locations pl ON pl.photographer_id = pp.id
         WHERE ${WHERE_APPROVED} AND pl.location_slug = $1
       )
       SELECT id, text, rating, created_at, client_name_override, client_db_name,
              photographer_id, photographer_name, photographer_slug, photographer_avatar,
              photo_url, client_country
       FROM ranked
       WHERE rn_per_photographer <= 2
       ORDER BY photo_url IS NULL, LENGTH(text) DESC
       LIMIT $2`,
      [locationSlug, limit]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Reviews from photographers who offer a specific shoot type.
 * `shootTypeNames` is an array of accepted canonical names (e.g. ["Couples"] or
 * alias sets like ["Solo Portrait", "Solo Travel"]).
 */
export async function getReviewsForShootType(shootTypeNames: string[], limit = 6, locale?: string): Promise<PublicReview[]> {
  try {
    if (!shootTypeNames.length) return [];
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${baseSelect(locale)},
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY LENGTH(COALESCE(r.text, '')) DESC) as rn_per_photographer
         ${BASE_JOINS}
         WHERE ${WHERE_APPROVED} AND pp.shoot_types && $1::text[]
       )
       SELECT id, text, rating, created_at, client_name_override, client_db_name,
              photographer_id, photographer_name, photographer_slug, photographer_avatar,
              photo_url, client_country
       FROM ranked
       WHERE rn_per_photographer <= 2
       ORDER BY photo_url IS NULL, LENGTH(text) DESC
       LIMIT $2`,
      [shootTypeNames, limit]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Short quote pulled per photographer — used as a one-liner on catalog cards.
 * Returns a map { photographerId → {text, clientName} }.
 */
export async function getOneLinerQuotesForPhotographers(
  photographerIds: string[],
  locale?: string,
): Promise<Record<string, { text: string; client_name: string | null }>> {
  if (!photographerIds.length) return {};
  try {
    const textCol = locale && REVIEW_LOCALES.has(locale) ? `COALESCE(r.text_${locale}, r.text)` : "r.text";
    const rows = await query<{
      photographer_id: string;
      text: string;
      client_name_override: string | null;
      client_db_name: string | null;
    }>(
      `SELECT DISTINCT ON (r.photographer_id)
        r.photographer_id, ${textCol} as text, r.client_name_override, cu.name as client_db_name
       FROM reviews r
       LEFT JOIN users cu ON cu.id = r.client_id
       WHERE r.is_approved = TRUE AND r.text IS NOT NULL
         AND LENGTH(r.text) BETWEEN 40 AND 220
         AND r.photographer_id = ANY($1::uuid[])
       ORDER BY r.photographer_id, r.created_at DESC`,
      [photographerIds]
    );
    const out: Record<string, { text: string; client_name: string | null }> = {};
    for (const r of rows) {
      out[r.photographer_id] = {
        text: r.text,
        client_name: r.client_name_override || r.client_db_name || null,
      };
    }
    return out;
  } catch {
    return {};
  }
}
