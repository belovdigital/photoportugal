import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { normalizeName } from "@/lib/format-name";
import { ActiveBadge, ResponseTimeBadge } from "@/components/ui/ActiveBadge";

interface FeaturedPhotographer {
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y: number;
  is_verified: boolean;
  rating: number;
  review_count: number;
  min_price: number | null;
  locations: string;
  last_active_at: string | null;
  avg_response_minutes: number | null;
}

export async function FeaturedPhotographers({ locale }: { locale?: string } = {}) {
  let photographers: FeaturedPhotographer[] = [];

  try {
    const TR = new Set(["pt", "de", "es", "fr"]);
    const useLoc = locale && TR.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    photographers = await query<FeaturedPhotographer>(
      `SELECT pp.slug, u.name, ${taglineSql} as tagline,
              u.avatar_url, pp.cover_url, pp.cover_position_y, pp.is_verified,
              pp.rating, pp.review_count,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as min_price,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_featured = TRUE AND pp.is_approved = TRUE
       ORDER BY RANDOM()
       LIMIT 4`
    );
  } catch {
    // DB not available or no featured photographers
  }

  if (photographers.length === 0) return null;

  const t = await getTranslations("home.featured");
  const tc = await getTranslations("common");

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

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {photographers.map((p) => (
          <Link
            key={p.slug}
            href={`/photographers/${p.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:shadow-lg"
          >
            {/* Cover / gradient */}
            <div className="relative h-36 bg-gradient-to-br from-primary-400 to-primary-700">
              {p.cover_url && (
                <OptimizedImage src={p.cover_url} alt={t("portfolioAlt", { name: normalizeName(p.name) })} width={600} quality={88} className="h-full w-full" style={{ objectPosition: `center ${p.cover_position_y ?? 50}%` }} />
              )}
              <span className="absolute right-3 top-3 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold text-yellow-900">
                {t("badge")}
              </span>
              {/* Avatar */}
              <div className="absolute -bottom-5 left-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-3 border-white bg-primary-100 text-sm font-bold text-primary-600 shadow">
                  {p.avatar_url ? (
                    <OptimizedImage src={p.avatar_url} alt={normalizeName(p.name)} width={200} className="h-full w-full" />
                  ) : (
                    normalizeName(p.name).charAt(0)
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-4 pt-8">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
                  {normalizeName(p.name)}
                </h3>
                <ActiveBadge lastSeenAt={p.last_active_at} />
                {p.is_verified && (
                  <svg className="h-4 w-4 shrink-0 text-accent-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {p.tagline && (
                <p className="mt-0.5 truncate text-xs text-gray-500">{p.tagline}</p>
              )}
              <ResponseTimeBadge avgMinutes={p.avg_response_minutes} compact />

              {/* Rating — only show if has reviews */}
              {p.review_count > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`h-3 w-3 ${i < Math.round(p.rating) ? "text-yellow-400" : "text-gray-200"}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs font-semibold text-gray-900">{Number(p.rating).toFixed(1)}</span>
                <span className="text-xs text-gray-400">({p.review_count})</span>
              </div>
              )}

              {/* Location */}
              {p.locations && (
                <p className="mt-1.5 truncate text-xs text-gray-400">{p.locations}</p>
              )}

              {/* Price — pinned to bottom */}
              <div className="mt-auto flex items-center justify-between border-t border-warm-100 pt-3">
                {p.min_price ? (
                  <span className="text-sm">
                    <span className="text-gray-400">{tc("from")} </span>
                    <span className="font-bold text-gray-900">&euro;{Math.round(Number(p.min_price))}</span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">{tc("contactForPricing")}</span>
                )}
                <span className="rounded bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white">
                  {tc("book")}
                </span>
              </div>
            </div>
          </Link>
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
