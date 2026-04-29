import { Link } from "@/i18n/navigation";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { normalizeName } from "@/lib/format-name";
import { ActiveBadge, ResponseTimeBadge } from "@/components/ui/ActiveBadge";
import { PhotographerCardCover } from "@/components/ui/PhotographerCardCover";
import { getTranslations, getLocale } from "next-intl/server";
import { formatDuration } from "@/lib/package-pricing";

export interface PhotographerCardCompactData {
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  cover_position_y?: number | null;
  /** Up to 4 extra portfolio thumbnails for the on-card carousel. Cover is index 0. */
  portfolio_thumbs?: string[] | null;
  is_featured?: boolean;
  is_verified?: boolean;
  is_founding?: boolean;
  rating: number;
  review_count: number;
  min_price: number | null;
  /** Pre-joined string like "Lisbon, Cascais, Porto", or null. */
  locations?: string | null;
  last_active_at?: string | null;
  avg_response_minutes?: number | null;
  /** Optional: top 2 packages rendered inline so visitors don't have to click
   *  through the profile to see prices. Used on high-intent landing pages
   *  (location/shoot-type/LP) where price discovery shortens the funnel. */
  packages?: { id: string; name: string; price: number; duration_minutes: number; num_photos: number }[];
  /** Total package count used for "View all N packages" link, even when only
   *  the top 2 are passed in `packages`. */
  packages_total_count?: number;
}

/**
 * Unified "compact full card" used wherever we list photographers outside the
 * main catalog: location detail pages, location+occasion pages, photoshoot
 * type pages, photo spot pages. Mirrors the gold-standard layout from
 * FeaturedPhotographers so visitors see the same rich card everywhere.
 *
 * Single corner badge — Featured outranks Verified outranks Founding —
 * because stacking them eats horizontal space and makes the name truncate.
 */
export async function PhotographerCardCompact({ p }: { p: PhotographerCardCompactData }) {
  const tc = await getTranslations("common");
  const tFeat = await getTranslations("home.featured");
  const locale = await getLocale();
  const packages = p.packages ?? [];
  const hasPackages = packages.length > 0;
  const totalPackages = p.packages_total_count ?? packages.length;

  // Build the thumbnail strip: cover first, then up to 4 portfolio photos.
  // De-duplicate so the same image isn't shown twice (some photographers re-use
  // a portfolio photo as their cover).
  const thumbs: string[] = [];
  if (p.cover_url) thumbs.push(p.cover_url);
  for (const u of p.portfolio_thumbs ?? []) {
    if (u && !thumbs.includes(u)) thumbs.push(u);
    if (thumbs.length >= 8) break;
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative">
        <PhotographerCardCover
          slug={p.slug}
          name={p.name}
          thumbnails={thumbs}
          coverPositionY={p.cover_position_y ?? null}
          height="h-56"
          altPrefix={tFeat("portfolioAlt", { name: "" }).replace(/\s*$/, "")}
        />

        {p.is_featured ? (
          <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold text-yellow-900">
            {tFeat("badge")}
          </span>
        ) : p.is_founding ? (
          <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-purple-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
            {tc("founding")}
          </span>
        ) : null}

        <div className="absolute -bottom-5 left-4 z-20">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-3 border-white bg-primary-100 text-sm font-bold text-primary-600 shadow">
            {p.avatar_url ? (
              <OptimizedImage src={p.avatar_url} alt={normalizeName(p.name)} width={200} className="h-full w-full" />
            ) : (
              normalizeName(p.name).charAt(0)
            )}
          </div>
        </div>
      </div>

      <Link href={`/photographers/${p.slug}`} className="flex flex-col p-4 pt-8">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
            {normalizeName(p.name)}
          </h3>
          {p.is_verified && (
            <svg
              className="h-4 w-4 shrink-0 text-sky-500"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-label={tc("verified")}
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <ActiveBadge lastSeenAt={p.last_active_at ?? null} />
        </div>

        {p.tagline && (
          <p className="mt-1 truncate text-xs text-gray-500">{p.tagline}</p>
        )}
        <ResponseTimeBadge avgMinutes={p.avg_response_minutes ?? null} compact />

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

        {p.locations && (
          <p className="mt-1.5 truncate text-xs text-gray-400">{p.locations}</p>
        )}
      </Link>

      {/* Bottom area — when the caller passes `packages`, replace the
          single "From €X / Book" CTA with a stack of clickable package
          rows (price + arrow → directly to /book/{slug}?package={id}). On
          high-intent ad landings this shortens the funnel by a click and
          lets the visitor compare options without leaving the card.
          Capped at 3 packages — beyond that the card overflows and reads
          as a menu rather than a quick decision. If a photographer has
          more, we surface a "View all N packages" link to the profile.
          When no packages are passed, fall back to the legacy compact CTA.
          `mt-auto` pins the area to the bottom of the card so cards in a
          stretched grid all align their CTAs. */}
      <div className="mt-auto px-4 pb-4">
        {hasPackages ? (
          <div className="border-t border-warm-100 pt-3 space-y-2">
            {packages.slice(0, 3).map((pkg) => (
              <Link
                key={pkg.id}
                href={`/book/${p.slug}?package=${pkg.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-warm-200 bg-warm-50 px-3 py-2 text-sm transition hover:border-primary-400 hover:bg-primary-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{pkg.name}</p>
                  <p className="truncate text-[11px] text-gray-500">
                    {formatDuration(pkg.duration_minutes, locale)}
                    {pkg.num_photos > 0 && ` · ${tc("photosUnit", { count: pkg.num_photos })}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="font-bold text-gray-900">&euro;{Math.round(Number(pkg.price))}</span>
                  <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
            {totalPackages > 3 && (
              <Link
                href={`/photographers/${p.slug}`}
                className="block rounded-xl border border-warm-200 bg-white px-3 py-2 text-center text-xs font-semibold text-primary-700 transition hover:border-primary-400 hover:bg-primary-50"
              >
                {tc("viewAllPackages", { count: totalPackages })}
              </Link>
            )}
          </div>
        ) : (
          <Link
            href={`/photographers/${p.slug}`}
            className="flex items-center justify-between border-t border-warm-100 pt-3"
          >
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
          </Link>
        )}
      </div>
    </div>
  );
}
