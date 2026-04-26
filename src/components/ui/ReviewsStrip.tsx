import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { formatPublicName } from "@/lib/format-name";
import type { PublicReview } from "@/lib/reviews-data";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function codeToFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max).split(" ").slice(0, -1).join(" ");
  return cut + "…";
}

interface ReviewsStripProps {
  reviews: PublicReview[];
  title?: string;
  subtitle?: string;
  maxPerRow?: 2 | 3;
  compact?: boolean;
}

export async function ReviewsStrip({ reviews, title, subtitle, maxPerRow = 3, compact = false }: ReviewsStripProps) {
  if (reviews.length === 0) return null;
  const tc = await getTranslations("common");

  const gridCls = maxPerRow === 2
    ? "sm:grid sm:grid-cols-2"
    : "sm:grid sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className={compact ? "" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"}>
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className={`-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory sm:mx-0 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 ${gridCls}`}>
        {reviews.map((r) => {
          const displayName = r.client_name ? formatPublicName(r.client_name) : tc("privateClient");
          const flag = codeToFlag(r.client_country);
          return (
            <Link
              key={r.id}
              href={`/photographers/${r.photographer_slug}`}
              className="group flex shrink-0 w-[85%] snap-start flex-col rounded-2xl border border-warm-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md sm:w-auto"
            >
              {r.photo_url && (
                <div className="mb-3 -mx-1 overflow-hidden rounded-xl">
                  <img src={r.photo_url} alt={tc("clientReviewPhotoAlt", { name: r.photographer_name })} className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  {flag && <span aria-hidden className="text-base leading-none">{flag}</span>}
                  <p className={`truncate text-sm font-semibold ${r.client_name ? "text-gray-900" : "text-gray-500 italic"}`}>
                    {displayName}
                  </p>
                </div>
                <div className="mt-1">
                  <Stars count={r.rating} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-700 line-clamp-5">
                {truncate(r.text, 240)}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-warm-100 pt-3">
                <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary-100 ring-1 ring-warm-200 transition group-hover:ring-primary-300">
                  {r.photographer_avatar ? (
                    <img src={r.photographer_avatar} alt={r.photographer_name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-600">
                      {r.photographer_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-primary-600">
                    {r.photographer_name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {tc("photographerRole")}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
