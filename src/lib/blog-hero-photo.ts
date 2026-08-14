import { query, queryOne } from "@/lib/db";
import { locations, locField } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import { localizeShootType } from "@/lib/shoot-type-labels";

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
export async function attachBlogHeroPhotos<T extends BlogHeroAttachable>(posts: T[], locale = "en"): Promise<T[]> {
  const matched = await matchBlogHeroPhotos(posts, locale);
  return fillRemainingHeroPhotos(matched);
}

async function matchBlogHeroPhotos<T extends BlogHeroAttachable>(posts: T[], locale = "en"): Promise<T[]> {
  return Promise.all(posts.map(async (p) => {
    const haystack = (p.title + " " + (p.target_keywords || "")).toLowerCase();
    // Match the locale's own words as well as the English ones. A Portuguese
    // post is titled "Sessão fotográfica de família em Lisboa" — "Lisboa" does
    // not contain "lisbon" and "família" does not contain "family", so an
    // English-only match found nothing and the card fell back to a placeholder.
    // Cities whose name is spelled the same either way (Porto, Sintra, Algarve)
    // are why this only ever showed up on some posts.
    const locSlugs = locations
      .filter((l) =>
        haystack.includes(l.name.toLowerCase()) ||
        haystack.includes((locField(l, "name", locale) || l.name).toLowerCase()) ||
        haystack.includes(l.slug)
      )
      .map((l) => l.slug);
    const stNames = shootTypes
      // Business photos are excluded from the candidate set below, so keeping
      // the term here can only ever subtract: a non-empty shoot-type array is
      // a hard filter, and a corporate post that also names a city loses the
      // city match to a term that cannot match anything.
      .filter((s) => s.slug !== "business")
      .filter((s) =>
        haystack.includes(s.name.toLowerCase()) ||
        haystack.includes(localizeShootType(s.name, locale).toLowerCase()) ||
        haystack.includes(s.slug)
      )
      // The pack's display name is not always what photographers tag. The solo
      // landing is titled "Solo Travel"; the value on a portfolio photo is
      // "Solo Portrait", and `Solo Travel` appears on zero rows in all three
      // markets — so every solo post matched the text and then found nothing.
      // `photographerShootTypeNames` is the pack's own answer to this and nine
      // other call sites already read it.
      .flatMap((s) => s.photographerShootTypeNames || [s.name]);
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
          AND pi.type = 'photo' AND COALESCE(lower(pi.shoot_type), '') <> 'business'
          AND (
            $2::text[] = ARRAY[]::text[]
            OR pi.shoot_type = ANY($2::text[])
            OR (pi.shoot_type IS NULL AND pp.shoot_types && $2::text[])
          )
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

/**
 * Whatever the matcher couldn't place gets an arbitrary portfolio photo rather
 * than the grey placeholder icon.
 *
 * The matcher only ever fires when a post's title or keywords name a location
 * or a shoot type, and only lands when a photo tagged that way exists. Most
 * posts satisfy neither: "¿Una hora o dos? Cuánto debe durar tu sesión de
 * fotos" names no city and no shoot type, so the whole Spanish and Italian
 * grids were placeholders — those markets have no stored cover_image_url at
 * all, so nothing else was left to draw.
 *
 * Posts that already carry a real cover_image_url are left alone: an editorial
 * cover outranks a filler.
 *
 * Deterministic, not random: the photo is chosen by hashing the post id, so a
 * post keeps the same face across re-renders, ISR revalidations and pagination
 * pages. `Math.random()` here would reshuffle the grid every 5 minutes.
 */
async function fillRemainingHeroPhotos<T extends BlogHeroAttachable>(posts: T[]): Promise<T[]> {
  const needsFiller = posts.filter((p) => !p.hero_photo_url && !p.cover_image_url);
  if (needsFiller.length === 0) return posts;

  // One query for the whole page. Ordering by hashtext keeps the pool stable
  // and mixes photographers together, so a page doesn't fill up with one
  // portfolio. Business photos stay out, as everywhere else on the leisure side.
  const pool = await query<{ url: string; photographer_name: string; photographer_slug: string }>(
    `SELECT pi.url, u.name as photographer_name, pp.slug as photographer_slug
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(pp.is_test, FALSE) = FALSE
        AND pi.type = 'photo'
        AND COALESCE(lower(pi.shoot_type), '') <> 'business'
      ORDER BY hashtext(pi.url)
      LIMIT 500`
  ).catch((e) => {
    console.error("[blog-hero-photo] filler pool query failed:", e);
    return [];
  });
  if (pool.length === 0) return posts;

  // Don't repeat a photo the matcher already put on this page, and don't repeat
  // a filler within the page either — until the pool runs out, which it does
  // on a market with fewer photos than posts.
  const used = new Set(posts.map((p) => p.hero_photo_url).filter(Boolean) as string[]);
  const fillerFor = new Map<string, (typeof pool)[number]>();

  for (const p of needsFiller) {
    let idx = hashToIndex(p.id, pool.length);
    for (let probe = 0; probe < pool.length && used.has(pool[idx].url); probe++) {
      idx = (idx + 1) % pool.length;
    }
    used.add(pool[idx].url);
    fillerFor.set(p.id, pool[idx]);
  }

  return posts.map((p) => {
    const filler = fillerFor.get(p.id);
    if (!filler) return p;
    return {
      ...p,
      hero_photo_url: filler.url,
      hero_photographer_name: filler.photographer_name,
      hero_photographer_slug: filler.photographer_slug,
    };
  });
}

/** FNV-1a, so the same post id always lands on the same pool slot. */
function hashToIndex(id: string, modulo: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % modulo;
}
