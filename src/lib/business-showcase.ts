// Corporate work, gathered for the B2B surfaces that are allowed to show it:
// the /for-business landing, the homepage B2B band and the Business tile on
// /photoshoots. Everywhere else business photos stay hidden — see
// BUSINESS_SHOOT_TYPE in shoot-type-labels for the invariant.
//
// Ranking is deliberate rather than random: with a young corporate pool the
// point is to lead with the strongest work, and to stay stable between
// renders so the same page doesn't reshuffle under a returning visitor.
import { query } from "@/lib/db";

/** Tier + rating first, then the order the photographer chose themselves. */
const RANK_SQL = `
  CASE
    WHEN pp.is_featured THEN 0
    WHEN pp.is_verified THEN 1
    WHEN COALESCE(pp.is_founding, FALSE) THEN 2
    ELSE 3
  END,
  pp.rating DESC NULLS LAST,
  pi.sort_order NULLS LAST, pi.created_at`;

const VISIBLE_SQL = `
  pi.type = 'photo'
  AND lower(pi.shoot_type) = 'business'
  AND pp.is_approved = TRUE
  AND COALESCE(pp.is_test, FALSE) = FALSE
  AND COALESCE(u.is_banned, FALSE) = FALSE`;

/** Best corporate photos platform-wide — hero and band backgrounds. */
export async function getBusinessPhotos(limit = 6): Promise<string[]> {
  try {
    const rows = await query<{ url: string }>(
      `SELECT pi.url
         FROM portfolio_items pi
         JOIN photographer_profiles pp ON pp.id = pi.photographer_id
         JOIN users u ON u.id = pp.user_id
        WHERE ${VISIBLE_SQL}
          AND lower(pi.url) NOT LIKE '%.heic'
          AND lower(pi.url) NOT LIKE '%.heif'
        ORDER BY ${RANK_SQL}
        LIMIT $1`,
      [limit]
    );
    return rows.map((r) => r.url);
  } catch {
    return [];
  }
}

export interface BusinessPhotographer {
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  rating: number;
  review_count: number;
  locations: string[];
  /** Corporate photos only — the card carousel shows nothing else. */
  photos: string[];
}

/**
 * Photographers who have actually shot corporate work, not everyone whose
 * Business toggle is on (it ships enabled, so that list is meaningless as
 * proof). Same rule as the catalog's Business filter.
 */
export async function getBusinessPhotographers(limit = 8): Promise<BusinessPhotographer[]> {
  try {
    return await query<BusinessPhotographer>(
      `SELECT pp.slug, u.name, pp.tagline, u.avatar_url, pp.is_verified,
              pp.rating::float as rating, pp.review_count,
              COALESCE((
                SELECT ARRAY_AGG(INITCAP(REPLACE(pl.location_slug, '-', ' ')) ORDER BY pl.location_slug)
                  FROM photographer_locations pl
                 WHERE pl.photographer_id = pp.id
              ), ARRAY[]::text[]) as locations,
              ARRAY(
                SELECT pi.url
                  FROM portfolio_items pi
                 WHERE pi.photographer_id = pp.id
                   AND pi.type = 'photo'
                   AND lower(pi.shoot_type) = 'business'
                 ORDER BY pi.sort_order NULLS LAST, pi.created_at
                 LIMIT 8
              ) as photos
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
        WHERE pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND COALESCE(u.is_banned, FALSE) = FALSE
          AND EXISTS (
            SELECT 1 FROM portfolio_items pi
             WHERE pi.photographer_id = pp.id
               AND pi.type = 'photo'
               AND lower(pi.shoot_type) = 'business'
          )
        ORDER BY
          CASE
            WHEN pp.is_featured THEN 0
            WHEN pp.is_verified THEN 1
            WHEN COALESCE(pp.is_founding, FALSE) THEN 2
            ELSE 3
          END,
          pp.rating DESC NULLS LAST,
          pp.review_count DESC
        LIMIT $1`,
      [limit]
    );
  } catch {
    return [];
  }
}
