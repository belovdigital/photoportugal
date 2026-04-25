import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getHomepageReviews, getSiteReviewStats } from "@/lib/reviews-data";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";

export async function TestimonialsSection() {
  const t = await getTranslations("testimonials");
  const [reviews, stats] = await Promise.all([getHomepageReviews(9), getSiteReviewStats()]);

  if (reviews.length === 0) return null;

  return (
    <section id="reviews" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 scroll-mt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yellow-800">
            {t("badge")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("title")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span><strong className="text-gray-900">{stats.avgRating.toFixed(1)}</strong></span>
          </div>
          <span className="whitespace-nowrap"><strong className="text-gray-900">{stats.count}</strong> {t("reviewCount", { count: stats.count })}</span>
          <span className="hidden sm:inline text-warm-300">&bull;</span>
          <span className="hidden sm:inline">{t("allReviewsVerified")}</span>
        </div>
      </div>

      <div className="mt-6 sm:mt-8">
        <ReviewsStrip reviews={reviews} compact />
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/photographers"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          {t("browseAll")}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
