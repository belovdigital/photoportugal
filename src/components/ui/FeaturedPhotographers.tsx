import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { query } from "@/lib/db";
import { PhotographerCardCompact } from "@/components/ui/PhotographerCardCompact";

interface FeaturedPhotographer {
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y: number;
  portfolio_thumbs: string[] | null;
  is_featured: boolean;
  is_verified: boolean;
  is_founding: boolean;
  rating: number;
  review_count: number;
  min_price: number | null;
  locations: string;
  last_active_at: string | null;
  avg_response_minutes: number | null;
}

const TOP_PHOTOGRAPHERS_LIMIT = 8;

export async function FeaturedPhotographers({ locale }: { locale?: string } = {}) {
  let photographers: FeaturedPhotographer[] = [];

  try {
    const TR = new Set(["pt", "de", "es", "fr"]);
    const useLoc = locale && TR.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    // Pool: featured ∪ verified ∪ founding. Featured photographers ALWAYS take
    // the leading slots (paid placement); the rest are randomized so the section
    // looks fresh on each ISR refresh. is_featured DESC pins paid first; RANDOM()
    // shuffles within tier — verified and founding are mixed together.
    photographers = await query<FeaturedPhotographer>(
      `SELECT pp.slug, u.name, ${taglineSql} as tagline,
              u.avatar_url, pp.cover_url, pp.cover_position_y,
              pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
              pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
              ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND (pp.is_featured = TRUE OR pp.is_verified = TRUE OR COALESCE(pp.is_founding, FALSE) = TRUE)
       ORDER BY pp.is_featured DESC, RANDOM()
       LIMIT $1`,
      [TOP_PHOTOGRAPHERS_LIMIT]
    );
  } catch {
    // DB not available or no featured photographers
  }

  if (photographers.length === 0) return null;

  const t = await getTranslations("home.featured");

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {t("badge")}
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-lg text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      {/* Reuses the unified PhotographerCardCompact — same component as
          locations / occasions / spots / shoot-type pages, so any future
          card tweaks land everywhere automatically. */}
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {photographers.map((p) => (
          <PhotographerCardCompact
            key={p.slug}
            p={{
              slug: p.slug,
              name: p.name,
              tagline: p.tagline,
              avatar_url: p.avatar_url,
              cover_url: p.cover_url,
              cover_position_y: p.cover_position_y,
              portfolio_thumbs: p.portfolio_thumbs,
              is_featured: p.is_featured,
              is_verified: p.is_verified,
              is_founding: p.is_founding,
              rating: Number(p.rating) || 0,
              review_count: p.review_count,
              min_price: p.min_price ? Number(p.min_price) : null,
              locations: p.locations,
              last_active_at: p.last_active_at,
              avg_response_minutes: p.avg_response_minutes,
            }}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/photographers"
          className="inline-flex rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
        >
          {t("viewAll")}
        </Link>
      </div>
    </section>
  );
}
