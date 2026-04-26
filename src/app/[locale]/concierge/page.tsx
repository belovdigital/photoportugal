import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConciergeChat } from "@/components/concierge/ConciergeChat";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getHomepageReviews } from "@/lib/reviews-data";
import { queryOne } from "@/lib/db";
import { locations as ALL_LOCATIONS } from "@/lib/locations-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "concierge" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ConciergePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "concierge" });

  const [reviews, stats] = await Promise.all([
    getHomepageReviews(6, locale).catch(() => []),
    queryOne<{ photographer_count: string; total_reviews: string; avg_rating: string; min_price: string | null }>(
      `SELECT
         (SELECT COUNT(*)::text FROM photographer_profiles WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE) AS photographer_count,
         (SELECT COUNT(*)::text FROM reviews WHERE is_approved = TRUE) AS total_reviews,
         (SELECT COALESCE(ROUND(AVG(rating)::numeric, 1)::text, '5.0') FROM reviews WHERE is_approved = TRUE) AS avg_rating,
         (SELECT MIN(price)::text FROM packages pk JOIN photographer_profiles pp ON pp.id = pk.photographer_id WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE AND pk.is_public = TRUE) AS min_price`
    ).catch(() => null),
  ]);

  const photographerCount = parseInt(stats?.photographer_count || "30");
  const totalReviews = parseInt(stats?.total_reviews || "0");
  const avgRating = stats?.avg_rating || "5.0";
  const locationsCount = ALL_LOCATIONS.length;
  const minPrice = stats?.min_price ? parseInt(stats.min_price) : 90;

  return (
    <div className="bg-warm-50 concierge-page">
      {/* Top section — full-viewport-height (minus header) on every breakpoint */}
      <section className="relative h-[calc(100dvh-64px)] bg-gradient-to-br from-warm-50 via-white to-primary-50/40 lg:h-[calc(100vh-64px)]">
        <div className="mx-auto h-full max-w-7xl px-0 sm:px-6 lg:px-8 lg:py-8">
          <div className="grid h-full grid-cols-1 gap-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
            {/* Info column — desktop only, vertically centered with proper hierarchy */}
            <aside className="hidden flex-col justify-center lg:flex">
              <span className="inline-flex items-center self-start gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 shadow-sm ring-1 ring-primary-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
                </span>
                {t("conciergeBadge")}
              </span>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-gray-900 xl:text-5xl">
                {t("title1")} <span className="text-primary-600">{t("title2")}</span>
              </h1>
              <p className="mt-5 max-w-lg text-base text-gray-600 leading-relaxed xl:text-lg">
                {t("subtitle")}
              </p>
              <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
                <div className="rounded-xl border border-warm-200 bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-gray-900">{photographerCount}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t("stats.photographers")}</p>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-gray-900">{locationsCount}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t("stats.locations")}</p>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-gray-900">⭐ {avgRating}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t("stats.rating", { count: totalReviews })}</p>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white/70 p-4 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-gray-900">€{minPrice}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t("stats.from")}</p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  {t("trustSecure")}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  {t("trustRefund")}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  {t("trustVerified")}
                </span>
              </div>
            </aside>

            {/* Chat column — full-height on every breakpoint */}
            <div className="flex h-full min-h-0 flex-col">
              <ConciergeChat locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* Below-the-fold marketing — hidden on mobile (full messenger UX) */}
      <div className="hidden sm:block">
        {/* How it works */}
        <section className="bg-warm-50">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("howItWorks.title")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              {[
                { n: "1", title: t("howItWorks.step1Title"), desc: t("howItWorks.step1Desc"), icon: "💬" },
                { n: "2", title: t("howItWorks.step2Title"), desc: t("howItWorks.step2Desc"), icon: "🎯" },
                { n: "3", title: t("howItWorks.step3Title"), desc: t("howItWorks.step3Desc"), icon: "📸" },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-warm-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.icon}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{s.n}</span>
                  </div>
                  <p className="mt-3 font-display text-lg font-semibold text-gray-900">{s.title}</p>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="border-y border-warm-200 bg-white">
            <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
              <ReviewsStrip
                reviews={reviews}
                title={t("reviews.title")}
                subtitle={t("reviews.subtitle")}
                compact
              />
            </div>
          </section>
        )}

        {/* Why us */}
        <section className="bg-warm-50">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("why.title")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
              {[
                { title: t("why.secure"), desc: t("why.secureDesc") },
                { title: t("why.refund"), desc: t("why.refundDesc") },
                { title: t("why.handPicked"), desc: t("why.handPickedDesc") },
                { title: t("why.response"), desc: t("why.responseDesc") },
              ].map((tt) => (
                <div key={tt.title} className="rounded-xl border border-warm-200 bg-white p-4">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 shrink-0 text-accent-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{tt.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{tt.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                {t("why.browsePrefix")}{" "}
                <Link href={`/${locale}/photographers`} className="font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-2">
                  {t("why.browseLink")}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
