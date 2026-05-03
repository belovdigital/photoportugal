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
  /** Whether this photographer actually covers the mentioned location.
   *  Lets the UI show "Featured in {location}" only when truthful. */
  covers_mentioned_location: boolean;
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

export type EndCapPhotographer = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y: number | null;
  portfolio_thumbs: string[];
  is_featured: boolean;
  is_verified: boolean;
  is_founding: boolean;
  rating: number;
  review_count: number;
  starting_price: string | null;
  locations: string | null;
  last_active_at: string | null;
  avg_response_minutes: number | null;
  packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number }[];
  packages_total_count: number;
};

export async function fetchBlogConversionAssets(opts: {
  postId: string;
  locationSlugs: string[];
  shootTypeNames: string[];
  locale?: string;
}): Promise<{
  heroCarousel: HeroCarouselData | null;
  photoStrip: PhotoStripItem[];
  breakouts: PhotographerBreakout[];
  reviews: TopicReview[];
  endCapPhotographers: EndCapPhotographer[];
}> {
  const { postId, locationSlugs, shootTypeNames, locale } = opts;

  // Bail early if the post mentions nothing — we have no signal to
  // pick photographers, so all assets stay empty and the page renders
  // the legacy single-cover layout.
  if (locationSlugs.length === 0 && shootTypeNames.length === 0) {
    return {
      heroCarousel: null,
      photoStrip: [],
      breakouts: [],
      reviews: [],
      endCapPhotographers: [],
    };
  }

  const [heroCarousel, photoStrip, breakouts, reviews, endCapPhotographers] = await Promise.all([
    fetchHeroCarousel(postId, locationSlugs, shootTypeNames),
    fetchPhotoStrip(postId, locationSlugs, shootTypeNames),
    fetchPhotographerBreakouts(postId, locationSlugs, shootTypeNames),
    fetchTopicReviews(locationSlugs, shootTypeNames),
    fetchEndCapPhotographers(postId, locationSlugs, shootTypeNames, locale),
  ]);

  return { heroCarousel, photoStrip, breakouts, reviews, endCapPhotographers };
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
        AND ($1::text[] = ARRAY[]::text[] OR pi.location_slug = ANY($1::text[]))
        -- Photographer must cover the location AND match the shoot type
        -- when both are present in the post. The photo itself must also
        -- be on-topic (matching shoot_type, or untagged-from-specialist).
        AND (
          $1::text[] = ARRAY[]::text[]
          OR EXISTS (
            SELECT 1 FROM photographer_locations plx
             WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          )
        )
        AND (
          $2::text[] = ARRAY[]::text[]
          OR pp.shoot_types && $2::text[]
        )
        AND (
          $2::text[] = ARRAY[]::text[]
          OR pi.shoot_type = ANY($2::text[])
          OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[])
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
        AND ($2::text[] = ARRAY[]::text[] OR pi.location_slug = ANY($2::text[]))
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
          -- If the post has a primary location, the strip photo itself must
          -- be tagged there; otherwise the "Real shots from X" label lies.
          AND (
            $1::text[] = ARRAY[]::text[]
            OR pi.location_slug = ANY($1::text[])
          )
          -- Strict AND: photographer covers location AND matches shoot type.
          AND (
            $1::text[] = ARRAY[]::text[]
            OR EXISTS (
              SELECT 1 FROM photographer_locations plx
               WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
            )
          )
          AND (
            $2::text[] = ARRAY[]::text[]
            OR pp.shoot_types && $2::text[]
          )
          -- Photo itself must be on-topic for the shoot_type when one is mentioned.
          AND (
            $2::text[] = ARRAY[]::text[]
            OR pi.shoot_type = ANY($2::text[])
            OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[])
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
  // Photographers who BOTH cover a mentioned location AND match a
  // mentioned shoot type score highest. Location-only is OK. Shoot-type
  // only is acceptable but ranks last so that "featured in {location}"
  // claims stay accurate.
  const photographers = await query<{
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    rating: number;
    review_count: number;
    tagline: string | null;
    covers_mentioned_location: boolean;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url,
            COALESCE(pp.rating, 0) as rating,
            COALESCE(pp.review_count, 0) as review_count,
            pp.tagline,
            EXISTS (
              SELECT 1 FROM photographer_locations plx
               WHERE plx.photographer_id = pp.id
                 AND ($1::text[] != ARRAY[]::text[] AND plx.location_slug = ANY($1::text[]))
            ) as covers_mentioned_location
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(pp.is_test, FALSE) = FALSE
        -- Require BOTH location AND shoot-type match when both are
        -- mentioned. If only one is mentioned, require that one. No
        -- fallback OR — a "Featured in Lisbon" claim must be true.
        AND (
          $1::text[] = ARRAY[]::text[]
          OR EXISTS (
            SELECT 1 FROM photographer_locations plx
             WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          )
        )
        AND (
          $2::text[] = ARRAY[]::text[]
          OR pp.shoot_types && $2::text[]
        )
        AND EXISTS (
          SELECT 1 FROM portfolio_items pix
           WHERE pix.photographer_id = pp.id
             AND pix.type = 'photo'
             AND ($1::text[] = ARRAY[]::text[] OR pix.location_slug = ANY($1::text[]))
             AND (
               $2::text[] = ARRAY[]::text[]
               OR pix.shoot_type = ANY($2::text[])
               OR pix.shoot_type IS NULL
             )
        )
      ORDER BY pp.is_featured DESC, pp.review_count DESC NULLS LAST,
               hashtext($3::text || pp.id::text)
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
              AND ($3::text[] = ARRAY[]::text[] OR pi.location_slug = ANY($3::text[]))
              AND (
                $4::text[] = ARRAY[]::text[]
                OR pi.shoot_type = ANY($4::text[])
                OR pi.shoot_type IS NULL
              )
            ORDER BY hashtext($2::text || pi.url),
                     pi.sort_order NULLS LAST, pi.created_at
            LIMIT 5`,
          [p.id, postId, locationSlugs, shootTypeNames]
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
          $1::text[] = ARRAY[]::text[]
          OR EXISTS (
            SELECT 1 FROM photographer_locations plx
             WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          )
        )
        AND (
          $2::text[] = ARRAY[]::text[]
          OR pp.shoot_types && $2::text[]
        )
      ORDER BY r.rating DESC, r.created_at DESC
      LIMIT 6`,
    [locationSlugs, shootTypeNames]
  ).catch(() => []);
}

// ---------------------------------------------------------------------------
// End-cap photographers — up to 6 different photographers shown as full
// "compact full" cards (same component used on /locations/[slug]). Strict
// AND match: photographer must cover a mentioned location AND match a
// mentioned shoot type when both are present. Returns all the data the
// PhotographerCardCompact component needs to render inline package CTAs.
async function fetchEndCapPhotographers(
  postId: string,
  locationSlugs: string[],
  shootTypeNames: string[],
  locale?: string
): Promise<EndCapPhotographer[]> {
  const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
  const useLoc = locale && TR_LOCALES.has(locale) ? locale : null;
  const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";

  return query<EndCapPhotographer>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url,
            pp.cover_url, pp.cover_position_y,
            pp.is_featured, pp.is_verified,
            COALESCE(pp.is_founding, FALSE) as is_founding,
            ${taglineSql} as tagline,
            COALESCE(pp.rating, 0) as rating,
            COALESCE(pp.review_count, 0) as review_count,
            u.last_seen_at as last_active_at, pp.avg_response_minutes,
            (SELECT MIN(price)::text FROM packages
              WHERE photographer_id = pp.id AND is_public = TRUE AND custom_for_user_id IS NULL) as starting_price,
            (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
            COALESCE((
              SELECT array_agg(url ORDER BY shuffle, sort_order NULLS LAST, created_at)
                FROM (
                  SELECT pi.url,
                         hashtext($3::text || pi.url) as shuffle,
                         pi.sort_order, pi.created_at
                    FROM portfolio_items pi
                   WHERE pi.photographer_id = pp.id
                     AND pi.type = 'photo'
                     AND ($1::text[] = ARRAY[]::text[] OR pi.location_slug = ANY($1::text[]))
                     AND (
                       $2::text[] = ARRAY[]::text[]
                       OR pi.shoot_type = ANY($2::text[])
                       OR pi.shoot_type IS NULL
                     )
                   ORDER BY shuffle, pi.sort_order NULLS LAST, pi.created_at
                   LIMIT 7
                ) ranked
            ), ARRAY[]::text[]) as portfolio_thumbs,
            COALESCE((
              SELECT json_agg(
                json_build_object(
                  'id', pk.id,
                  'name', pk.name,
                  'price', pk.price,
                  'duration_minutes', pk.duration_minutes,
                  'num_photos', COALESCE(pk.num_photos, 0)
                ) ORDER BY pk.sort_order NULLS LAST, pk.price ASC
              )
              FROM packages pk
              WHERE pk.photographer_id = pp.id
                AND pk.is_public = TRUE
                AND pk.custom_for_user_id IS NULL
            ), '[]'::json) as packages,
            (SELECT COUNT(*) FROM packages
              WHERE photographer_id = pp.id
                AND is_public = TRUE
                AND custom_for_user_id IS NULL)::int as packages_total_count
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(pp.is_test, FALSE) = FALSE
        -- Strict AND: must cover the mentioned location AND match the
        -- mentioned shoot type when both are present.
        AND (
          $1::text[] = ARRAY[]::text[]
          OR EXISTS (
            SELECT 1 FROM photographer_locations plx
             WHERE plx.photographer_id = pp.id AND plx.location_slug = ANY($1::text[])
          )
        )
        AND (
          $2::text[] = ARRAY[]::text[]
          OR pp.shoot_types && $2::text[]
        )
        -- Only include photographers with at least one bookable package
        -- so the "View packages" CTA on the card always lands somewhere.
        AND EXISTS (
          SELECT 1 FROM packages pk
           WHERE pk.photographer_id = pp.id
             AND pk.is_public = TRUE
             AND pk.custom_for_user_id IS NULL
        )
      ORDER BY pp.is_featured DESC,
               pp.is_verified DESC,
               pp.review_count DESC NULLS LAST,
               hashtext($3::text || pp.id::text)
      LIMIT 6`,
    [locationSlugs, shootTypeNames, postId]
  ).catch(() => []);
}
