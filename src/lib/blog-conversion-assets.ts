import { query, queryOne } from "@/lib/db";

/**
 * Fetches all the carousel data a single blog post page needs to do
 * its conversion job: hero photo strip, mid-post photographer
 * breakouts, photo-strip cross-photographer, reviews carousel, and the
 * end-cap package picker. One trip to the DB per blog page render
 * (split into ~5 small indexed queries that run in parallel).
 *
 * Inputs are the slugs/names already extracted in the page from the
 * post's title + content (mentioned locations, mentioned shoot types,
 * post id for stable shuffling).
 */

export type HeroCarouselData = {
  thumbnails: string[];
  photographerName: string;
  photographerSlug: string;
};

export type PhotoStripItem = {
  url: string;
  photographer_name: string;
  photographer_slug: string;
};

export type PhotographerBreakout = {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  tagline: string | null;
  thumbnails: string[];
  packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number; is_popular: boolean }[];
};

export type TopicReview = {
  id: string;
  rating: number;
  title: string | null;
  text: string | null;
  client_name: string | null;
  photographer_name: string;
  photographer_slug: string;
};

export type EndCapPackage = {
  id: string;
  name: string;
  price: string;
  duration_minutes: number;
  num_photos: number;
  is_popular: boolean;
  photographer_slug: string;
  photographer_name: string;
  photographer_avatar: string | null;
  rating: number;
  review_count: number;
  portfolio_thumbs: string[];
};

export async function fetchBlogConversionAssets(opts: {
  postId: string;
  locationSlugs: string[];
  shootTypeNames: string[];
}): Promise<{
  heroCarousel: HeroCarouselData | null;
  photoStrip: PhotoStripItem[];
  breakouts: PhotographerBreakout[];
  reviews: TopicReview[];
  endCapPackages: EndCapPackage[];
}> {
  const { postId, locationSlugs, shootTypeNames } = opts;

  // Bail early if the post mentions nothing — we have no signal to
  // pick photographers, so all assets stay empty and the page renders
  // the legacy single-cover layout.
  if (locationSlugs.length === 0 && shootTypeNames.length === 0) {
    return {
      heroCarousel: null,
      photoStrip: [],
      breakouts: [],
      reviews: [],
      endCapPackages: [],
    };
  }

  const [heroCarousel, photoStrip, breakouts, reviews, endCapPackages] = await Promise.all([
    fetchHeroCarousel(postId, locationSlugs, shootTypeNames),
    fetchPhotoStrip(postId, locationSlugs, shootTypeNames),
    fetchPhotographerBreakouts(postId, locationSlugs, shootTypeNames),
    fetchTopicReviews(locationSlugs, shootTypeNames),
    fetchEndCapPackages(postId, locationSlugs, shootTypeNames),
  ]);

  return { heroCarousel, photoStrip, breakouts, reviews, endCapPackages };
}

// ---------------------------------------------------------------------------
// Hero — 5 photos from ONE photographer (carousel feels coherent on hero).
async function fetchHeroCarousel(
  postId: string,
  locationSlugs: string[],
  shootTypeNames: string[]
): Promise<HeroCarouselData | null> {
  const result = await queryOne<{ photographer_id: string; photographer_name: string; photographer_slug: string }>(
    `SELECT pp.id as photographer_id, u.name as photographer_name, pp.slug as photographer_slug
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(pp.is_test, FALSE) = FALSE
        AND pi.type = 'photo'
        AND ($2::text[] = ARRAY[]::text[] OR pi.shoot_type = ANY($2::text[]) OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[]))
        AND (
          ($1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]))
          OR ($2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]))
          OR EXISTS (
            SELECT 1 FROM photographer_locations plx
             WHERE plx.photographer_id = pp.id
               AND ($1::text[] != ARRAY[]::text[] AND plx.location_slug = ANY($1::text[]))
          )
        )
      ORDER BY hashtext($3::text || pp.id::text), pp.is_featured DESC, pp.review_count DESC NULLS LAST
      LIMIT 1`,
    [locationSlugs, shootTypeNames, postId]
  ).catch(() => null);

  if (!result) return null;

  const photos = await query<{ url: string }>(
    `SELECT pi.url
       FROM portfolio_items pi
      WHERE pi.photographer_id = $1
        AND pi.type = 'photo'
        AND ($3::text[] = ARRAY[]::text[] OR pi.shoot_type = ANY($3::text[]) OR pi.shoot_type IS NULL)
      ORDER BY
        CASE
          WHEN $2::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($2::text[])
               AND $3::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($3::text[]) THEN 0
          WHEN $2::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($2::text[]) THEN 1
          WHEN $3::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($3::text[]) THEN 2
          ELSE 3
        END,
        hashtext($4::text || pi.url),
        pi.sort_order NULLS LAST,
        pi.created_at
      LIMIT 5`,
    [result.photographer_id, locationSlugs, shootTypeNames, postId]
  ).catch(() => []);

  if (photos.length === 0) return null;

  return {
    thumbnails: photos.map((p) => p.url),
    photographerName: result.photographer_name,
    photographerSlug: result.photographer_slug,
  };
}

// ---------------------------------------------------------------------------
// Photo strip — 10 photos from MULTIPLE photographers (variety strip).
async function fetchPhotoStrip(
  postId: string,
  locationSlugs: string[],
  shootTypeNames: string[]
): Promise<PhotoStripItem[]> {
  return query<PhotoStripItem>(
    `WITH ranked AS (
       SELECT pi.url, u.name as photographer_name, pp.slug as photographer_slug,
              ROW_NUMBER() OVER (
                PARTITION BY pp.id
                ORDER BY
                  CASE
                    WHEN $1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[])
                         AND $2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]) THEN 0
                    WHEN $1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]) THEN 1
                    WHEN $2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]) THEN 2
                    ELSE 3
                  END,
                  hashtext($3::text || pi.url)
              ) as rn,
              CASE
                WHEN $1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[])
                     AND $2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]) THEN 0
                WHEN $1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]) THEN 1
                WHEN $2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]) THEN 2
                ELSE 3
              END as match_rank
         FROM portfolio_items pi
         JOIN photographer_profiles pp ON pp.id = pi.photographer_id
         JOIN users u ON u.id = pp.user_id
        WHERE pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND pi.type = 'photo'
          AND ($2::text[] = ARRAY[]::text[] OR pi.shoot_type = ANY($2::text[]) OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[]))
          AND (
            ($1::text[] != ARRAY[]::text[] AND pi.location_slug = ANY($1::text[]))
            OR ($2::text[] != ARRAY[]::text[] AND pi.shoot_type = ANY($2::text[]))
            OR EXISTS (
              SELECT 1 FROM photographer_locations plx
               WHERE plx.photographer_id = pp.id
                 AND ($1::text[] != ARRAY[]::text[] AND plx.location_slug = ANY($1::text[]))
            )
          )
     )
     SELECT url, photographer_name, photographer_slug
       FROM ranked
      WHERE rn <= 2  -- max 2 photos per photographer for variety
      ORDER BY match_rank, hashtext($3::text || url)
      LIMIT 10`,
    [locationSlugs, shootTypeNames, postId]
  ).catch(() => []);
}

// ---------------------------------------------------------------------------
// Photographer breakouts — up to 3 different photographers with a small
// portfolio strip (5 photos) + their top 2 packages each.
async function fetchPhotographerBreakouts(
  postId: string,
  locationSlugs: string[],
  shootTypeNames: string[]
): Promise<PhotographerBreakout[]> {
  const photographers = await query<{
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    rating: number;
    review_count: number;
    tagline: string | null;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url,
            COALESCE(pp.rating, 0) as rating,
            COALESCE(pp.review_count, 0) as review_count,
            pp.tagline
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(pp.is_test, FALSE) = FALSE
        AND (
          ($1::text[] != ARRAY[]::text[] AND EXISTS (
             SELECT 1 FROM photographer_locations plx
              WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          ))
          OR ($2::text[] != ARRAY[]::text[] AND pp.shoot_types && $2::text[])
        )
      ORDER BY hashtext($3::text || pp.id::text),
               pp.is_featured DESC, pp.review_count DESC NULLS LAST
      LIMIT 3`,
    [locationSlugs, shootTypeNames, postId]
  ).catch(() => []);

  if (photographers.length === 0) return [];

  // Fetch thumbnails + packages per photographer (parallel).
  return Promise.all(
    photographers.map(async (p) => {
      const [thumbs, packages] = await Promise.all([
        query<{ url: string }>(
          `SELECT pi.url FROM portfolio_items pi
            WHERE pi.photographer_id = $1 AND pi.type = 'photo'
            ORDER BY hashtext($2::text || pi.url),
                     pi.sort_order NULLS LAST, pi.created_at
            LIMIT 5`,
          [p.id, postId]
        ).catch(() => []),
        query<{ id: string; name: string; price: number; duration_minutes: number; num_photos: number; is_popular: boolean }>(
          `SELECT id, name, price, duration_minutes,
                  COALESCE(num_photos, 0) as num_photos,
                  COALESCE(is_popular, FALSE) as is_popular
             FROM packages
            WHERE photographer_id = $1
              AND is_public = TRUE
              AND custom_for_user_id IS NULL
            ORDER BY is_popular DESC NULLS LAST, sort_order NULLS LAST, price
            LIMIT 2`,
          [p.id]
        ).catch(() => []),
      ]);
      return {
        ...p,
        thumbnails: thumbs.map((t) => t.url),
        packages,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Reviews — match topic by photographer's locations / shoot types.
async function fetchTopicReviews(
  locationSlugs: string[],
  shootTypeNames: string[]
): Promise<TopicReview[]> {
  return query<TopicReview>(
    `SELECT r.id, r.rating, r.title, r.text,
            COALESCE(r.client_name_override, cu.name) as client_name,
            u.name as photographer_name, pp.slug as photographer_slug
       FROM reviews r
       JOIN photographer_profiles pp ON pp.id = r.photographer_id
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN users cu ON cu.id = r.client_id
      WHERE COALESCE(r.is_approved, TRUE) = TRUE
        AND r.text IS NOT NULL
        AND LENGTH(r.text) > 60
        AND r.rating >= 4
        AND (
          ($1::text[] != ARRAY[]::text[] AND EXISTS (
             SELECT 1 FROM photographer_locations plx
              WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          ))
          OR ($2::text[] != ARRAY[]::text[] AND pp.shoot_types && $2::text[])
        )
      ORDER BY r.rating DESC, r.created_at DESC
      LIMIT 6`,
    [locationSlugs, shootTypeNames]
  ).catch(() => []);
}

// ---------------------------------------------------------------------------
// End-cap packages — 6 packages from 6 different photographers.
async function fetchEndCapPackages(
  postId: string,
  locationSlugs: string[],
  shootTypeNames: string[]
): Promise<EndCapPackage[]> {
  return query<EndCapPackage>(
    `WITH per_photographer AS (
       SELECT pk.id, pk.name, pk.price::text AS price, pk.duration_minutes,
              COALESCE(pk.num_photos, 0) as num_photos,
              pp.id as profile_id,
              pp.slug as photographer_slug, u.name as photographer_name,
              u.avatar_url as photographer_avatar,
              COALESCE(pp.rating, 0) as rating,
              COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pk.is_popular, FALSE) as is_popular,
              pp.is_featured,
              ROW_NUMBER() OVER (
                PARTITION BY pp.id
                ORDER BY COALESCE(pk.is_popular, FALSE) DESC, pk.price ASC
              ) as rn_per_photographer
         FROM packages pk
         JOIN photographer_profiles pp ON pp.id = pk.photographer_id
         JOIN users u ON u.id = pp.user_id
        WHERE pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND pk.is_public = TRUE
          AND pk.custom_for_user_id IS NULL
          AND (
            ($1::text[] != ARRAY[]::text[] AND EXISTS (
               SELECT 1 FROM photographer_locations plx
                WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
            ))
            OR ($2::text[] != ARRAY[]::text[] AND pp.shoot_types && $2::text[])
          )
     )
     SELECT id, name, price, duration_minutes, num_photos,
            photographer_slug, photographer_name, photographer_avatar,
            rating, review_count, is_popular,
            COALESCE((
              SELECT array_agg(url ORDER BY shuffle, sort_order NULLS LAST, created_at)
                FROM (
                  SELECT pi.url,
                         hashtext(pp.profile_id::text || pi.url) as shuffle,
                         pi.sort_order, pi.created_at
                    FROM portfolio_items pi
                   WHERE pi.photographer_id = pp.profile_id
                     AND pi.type = 'photo'
                   ORDER BY shuffle, pi.sort_order NULLS LAST, pi.created_at
                   LIMIT 5
                ) ranked
            ), ARRAY[]::text[]) as portfolio_thumbs
       FROM per_photographer pp
      WHERE rn_per_photographer = 1
      ORDER BY pp.is_featured DESC,
               pp.is_popular DESC NULLS LAST,
               pp.review_count DESC NULLS LAST,
               hashtext($3::text || pp.profile_id::text)
      LIMIT 6`,
    [locationSlugs, shootTypeNames, postId]
  ).catch(() => []);
}
