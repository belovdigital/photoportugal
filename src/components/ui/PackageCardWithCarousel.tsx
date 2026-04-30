import { Link } from "@/i18n/navigation";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { PhotographerCardCover } from "@/components/ui/PhotographerCardCover";
import { normalizeName } from "@/lib/format-name";
import { getTranslations } from "next-intl/server";

export interface PackageCardWithCarouselData {
  id: string;
  name: string;
  price: number | string;
  duration_minutes: number;
  num_photos: number;
  is_popular?: boolean;
  photographer_slug: string;
  photographer_name: string;
  photographer_avatar: string | null;
  rating: number;
  review_count: number;
  /** Up to 5 portfolio photos for the on-card carousel — already filtered
   *  by location/shoot-type when relevant on the calling page. */
  portfolio_thumbs?: string[] | null;
}

/**
 * Package card with a scroll-snap photo carousel at the top, mirroring
 * the visual hierarchy of `PhotographerCardCompact` but scoped to a
 * single bookable package. Used on /locations/[slug]/[occasion] and
 * /photoshoots/[type] where featured packages are surfaced.
 *
 * The carousel uses the existing `PhotographerCardCover` component
 * verbatim — no point reimplementing scroll-snap, lightbox, lazy
 * mounting twice.
 */
export async function PackageCardWithCarousel({
  pkg,
  popularLabel,
  minutesAbbrLabel,
  photosLabel,
  bookCtaLabel,
}: {
  pkg: PackageCardWithCarouselData;
  popularLabel: string;
  minutesAbbrLabel: string;
  photosLabel: string;
  bookCtaLabel: string;
}) {
  const tc = await getTranslations("common");
  const thumbs = (pkg.portfolio_thumbs ?? []).filter(Boolean).slice(0, 5);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative">
        {thumbs.length > 0 ? (
          <PhotographerCardCover
            slug={pkg.photographer_slug}
            name={pkg.photographer_name}
            thumbnails={thumbs}
            coverPositionY={null}
            height="h-56"
          />
        ) : (
          // Fallback when the photographer has no portfolio yet — keep
          // the card height consistent with carousel cards in the same row.
          <div className="h-56 bg-gradient-to-br from-warm-100 to-warm-200" />
        )}

        {pkg.is_popular && (
          <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 shadow">
            {popularLabel}
          </span>
        )}

        <div className="absolute -bottom-5 left-4 z-20">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-3 border-white bg-primary-100 text-sm font-bold text-primary-600 shadow">
            {pkg.photographer_avatar ? (
              <OptimizedImage
                src={pkg.photographer_avatar}
                alt={normalizeName(pkg.photographer_name)}
                width={200}
                className="h-full w-full"
              />
            ) : (
              normalizeName(pkg.photographer_name).charAt(0)
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/book/${pkg.photographer_slug}?package=${pkg.id}`}
        className="flex flex-1 flex-col p-4 pt-7"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {normalizeName(pkg.photographer_name)}
          </p>
          {pkg.review_count > 0 && (
            <p className="text-xs text-gray-500">
              ★ {Number(pkg.rating).toFixed(1)} · {pkg.review_count}{" "}
              {pkg.review_count === 1 ? tc("review") : tc("reviews")}
            </p>
          )}
        </div>

        <h3 className="mt-3 font-display text-lg font-bold text-gray-900 group-hover:text-primary-600">
          {pkg.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {pkg.duration_minutes} {minutesAbbrLabel}
          {pkg.num_photos > 0 && ` · ${pkg.num_photos} ${photosLabel}`}
        </p>

        <div className="mt-auto pt-4 flex items-baseline justify-between">
          <span className="text-2xl font-bold text-gray-900">
            €{Math.round(Number(pkg.price))}
          </span>
          <span className="text-sm font-semibold text-primary-600 group-hover:underline">
            {bookCtaLabel} →
          </span>
        </div>
      </Link>
    </div>
  );
}
