import { query } from "@/lib/db";

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

const BASE_SELECT = `
  r.id, r.text, r.rating, r.created_at,
  r.client_name_override,
  cu.name as client_db_name,
  pp.id as photographer_id,
  pu.name as photographer_name,
  pp.slug as photographer_slug,
  pu.avatar_url as photographer_avatar,
  (SELECT rp.url FROM review_photos rp WHERE rp.review_id = r.id AND rp.is_public = TRUE ORDER BY rp.created_at LIMIT 1) as photo_url,
  (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = r.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at ASC LIMIT 1) as client_country
`;

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
 * Curated homepage / section-level reviews: prefer reviews with photos,
 * max 2 per photographer for variety.
 */
export async function getHomepageReviews(limit = 9): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${BASE_SELECT},
                ROW_NUMBER() OVER (PARTITION BY r.photographer_id ORDER BY LENGTH(COALESCE(r.text, '')) DESC) as rn_per_photographer
         ${BASE_JOINS}
         WHERE ${WHERE_APPROVED}
       )
       SELECT id, text, rating, created_at, client_name_override, client_db_name,
              photographer_id, photographer_name, photographer_slug, photographer_avatar,
              photo_url, client_country
       FROM ranked
       WHERE rn_per_photographer <= 2
       ORDER BY photo_url IS NULL, LENGTH(text) DESC
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
export async function getReviewsForPhotographer(photographerId: string, limit = 3): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `SELECT ${BASE_SELECT}
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
export async function getReviewsForLocation(locationSlug: string, limit = 6): Promise<PublicReview[]> {
  try {
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${BASE_SELECT},
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
export async function getReviewsForShootType(shootTypeNames: string[], limit = 6): Promise<PublicReview[]> {
  try {
    if (!shootTypeNames.length) return [];
    const rows = await query<DbRow>(
      `WITH ranked AS (
         SELECT ${BASE_SELECT},
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
  photographerIds: string[]
): Promise<Record<string, { text: string; client_name: string | null }>> {
  if (!photographerIds.length) return {};
  try {
    const rows = await query<{
      photographer_id: string;
      text: string;
      client_name_override: string | null;
      client_db_name: string | null;
    }>(
      `SELECT DISTINCT ON (r.photographer_id)
        r.photographer_id, r.text, r.client_name_override, cu.name as client_db_name
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
