import { queryOne } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";

export type BlogHeroAttachable = {
  id: string;
  title: string;
  target_keywords?: string | null;
  cover_image_url: string | null;
  hero_photo_url?: string | null;
  hero_photographer_name?: string | null;
  hero_photographer_slug?: string | null;
};

/**
 * For each post, derive a portfolio cover from a real photographer that
 * matches the post's mentioned location/shoot type. Posts whose
 * title/keywords don't mention either are left untouched (their stored
 * cover_image_url stays the source of truth).
 *
 * Match ranking (lower = better):
 *   0  location AND shoot_type tagged
 *   1  location-only tagged
 *   2  shoot_type-only tagged
 *   3  photographer covers the location (photo itself untagged)
 *
 * Photos with a CONFLICTING shoot_type are excluded — a solo-travel
 * post can't get a proposal photo just because they share a location.
 *
 * One SQL per post; runs in parallel via Promise.all. ~12 small indexed
 * queries per page render is cheap and keeps the data flow simple.
 */
export async function attachBlogHeroPhotos<T extends BlogHeroAttachable>(posts: T[]): Promise<T[]> {
  return Promise.all(posts.map(async (p) => {
    const haystack = (p.title + " " + (p.target_keywords || "")).toLowerCase();
    const locSlugs = locations
      .filter((l) => haystack.includes(l.name.toLowerCase()) || haystack.includes(l.slug))
      .map((l) => l.slug);
    const stNames = shootTypes
      .filter((s) => haystack.includes(s.name.toLowerCase()) || haystack.includes(s.slug))
      .map((s) => s.name);
    if (locSlugs.length === 0 && stNames.length === 0) return p;
    const hero = await queryOne<{ url: string; photographer_name: string; photographer_slug: string }>(
      `SELECT pi.url, u.name as photographer_name, pp.slug as photographer_slug,
              CASE
                WHEN $1::text[] != ARRAY[]::text[]
                     AND $2::text[] != ARRAY[]::text[]
                     AND pi.location_slug = ANY($1::text[])
                     AND pi.shoot_type = ANY($2::text[]) THEN 0
                WHEN $1::text[] != ARRAY[]::text[]
                     AND pi.location_slug = ANY($1::text[]) THEN 1
                WHEN $2::text[] != ARRAY[]::text[]
                     AND pi.shoot_type = ANY($2::text[]) THEN 2
                ELSE 3
              END as match_rank
         FROM portfolio_items pi
         JOIN photographer_profiles pp ON pp.id = pi.photographer_id
         JOIN users u ON u.id = pp.user_id
        WHERE pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND pi.type = 'photo'
          AND ($2::text[] = ARRAY[]::text[] OR pi.shoot_type IS NULL OR pi.shoot_type = ANY($2::text[]))
          AND (
            ($1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]))
            OR ($2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]))
            OR EXISTS (
              SELECT 1 FROM photographer_locations plx
               WHERE plx.photographer_id = pp.id
                 AND ($1::text[] != ARRAY[]::text[] AND plx.location_slug = ANY($1::text[]))
            )
          )
        ORDER BY match_rank, hashtext($3::text || pi.url)
        LIMIT 1`,
      [locSlugs, stNames, p.id]
    ).catch(() => null);
    if (!hero) return p;
    return {
      ...p,
      hero_photo_url: hero.url,
      hero_photographer_name: hero.photographer_name,
      hero_photographer_slug: hero.photographer_slug,
    };
  }));
}
