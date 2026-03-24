"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PhotographerProfile } from "@/types";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { trackViewPhotographer } from "@/lib/analytics";

export function PhotographerCard({
  photographer,
}: {
  photographer: PhotographerProfile;
}) {
  const t = useTranslations("photographers.card");
  const tc = useTranslations("common");
  const minPrice = photographer.packages?.length > 0
    ? Math.min(...photographer.packages.map(p => p.price))
    : null;

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:shadow-lg"
      onClick={() => trackViewPhotographer(photographer.slug, photographer.display_name)}
    >
      <Link
        href={`/photographers/${photographer.slug}`}
        className="block"
      >
      {/* Cover */}
      <div className="relative h-48 bg-gradient-to-br from-primary-300 to-primary-600">
        {photographer.cover_url && (
          <OptimizedImage src={photographer.cover_url} alt={t("coverAlt", { name: photographer.display_name })} width={800} quality={88} className="h-full w-full" style={{ objectPosition: `center ${photographer.cover_position_y ?? 50}%` }} />
        )}
        {photographer.is_founding ? (
          <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow">
            {t("founding")}
          </span>
        ) : photographer.is_featured ? (
          <span className="absolute right-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-yellow-900">
            {t("featured")}
          </span>
        ) : null}
        {/* Avatar */}
        <div className="absolute -bottom-6 left-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-primary-100 text-xl font-bold text-primary-600 shadow-md overflow-hidden">
            {photographer.avatar_url ? (
              <OptimizedImage src={photographer.avatar_url} alt={photographer.display_name} width={200} className="h-full w-full" />
            ) : (
              photographer.display_name.charAt(0)
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 pt-10 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition">
              {photographer.display_name}
            </h3>
            <p className="text-sm text-gray-500">{photographer.tagline}</p>
          </div>
          {photographer.is_verified && (
            <span className="shrink-0 text-accent-500" title={t("verified")}>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>

        {/* Rating */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`h-4 w-4 ${i < Math.round(photographer.rating) ? "text-yellow-400" : "text-gray-200"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {photographer.rating}
          </span>
          <span className="text-sm text-gray-400">
            ({photographer.review_count} {photographer.review_count === 1 ? tc("review") : tc("reviews")})
          </span>
        </div>

        {/* Locations */}
        <div className="mt-3 flex flex-wrap gap-1">
          {photographer.locations.map((loc) => (
            <span
              key={loc.slug}
              className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-warm-700"
            >
              {loc.name}
            </span>
          ))}
        </div>

        {/* Languages */}
        {photographer.languages.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            {t("speaks", { languages: photographer.languages.join(", ") })}
          </p>
        )}
      </div>
      </Link>

      {/* Price & actions — outside main Link to avoid nested <a> */}
      <div className="flex items-center justify-between border-t border-warm-100 mx-6 py-4">
        <div>
          {minPrice ? (
            <>
              <span className="text-sm text-gray-400">{t("from")} </span>
              <span className="text-lg font-bold text-gray-900">
                &euro;{minPrice}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">{t("contactForPricing")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/photographers/${photographer.slug}#message`}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-warm-200 text-gray-400 transition hover:border-primary-400 hover:text-primary-600"
            title={t("messagePhotographer", { name: photographer.display_name })}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
          <Link
            href={`/photographers/${photographer.slug}`}
            className="rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white"
          >
            {t("viewProfile")}
          </Link>
        </div>
      </div>
    </div>
  );
}
