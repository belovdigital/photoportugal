import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes, getShootTypeBySlug, shootTypeLocalized } from "@/lib/shoot-types-data";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForShootType } from "@/lib/reviews-data";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { localeAlternates } from "@/lib/seo";
import { query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { normalizeName } from "@/lib/format-name";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { adaptToPhotographerProfile } from "@/lib/photographer-adapter";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";

export function generateStaticParams() {
  return shootTypes.map((t) => ({ type: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}): Promise<Metadata> {
  const { locale, type } = await params;
  const shootType = getShootTypeBySlug(type);
  if (!shootType) return {};
  const loc = shootTypeLocalized(shootType, locale);

  return {
    title: loc.title,
    description: loc.metaDescription,
    alternates: localeAlternates(`/photoshoots/${type}`, locale),
    openGraph: {
      title: loc.title,
      description: loc.metaDescription,
      type: "website",
      url: `https://photoportugal.com/photoshoots/${type}`,
    },
  };
}

export default async function ShootTypePage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("shootTypesPage");
  const tc = await getTranslations("common");

  const shootType = getShootTypeBySlug(type);

  if (!shootType) {
    notFound();
  }

  const stl = shootTypeLocalized(shootType, locale);

  // Fetch related blog posts mentioning this shoot type
  const relatedPosts = await query<{
    slug: string; title: string; excerpt: string | null; cover_image_url: string | null;
  }>(
    `SELECT slug, title, excerpt, cover_image_url FROM blog_posts
     WHERE is_published = TRUE AND (
       LOWER(title) LIKE $1 OR LOWER(content) LIKE $1 OR LOWER(title) LIKE $2 OR LOWER(content) LIKE $2
     ) ORDER BY published_at DESC LIMIT 4`,
    [`%${shootType.slug}%`, `%${shootType.name.toLowerCase()}%`]
  ).catch(() => []);

  // Fetch photographers who do this shoot type
  const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
  const useLoc = TR_LOCALES.has(locale) ? locale : null;
  const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
  // Pull the full PhotographerCardCompact field set so this page renders the
  // gold-standard card. Replaces the older row that only had cover/avatar/name.
  const photographers = await query<{
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null;
    rating: number; review_count: number; starting_price: string | null;
    locations: string | null;
    last_active_at: string | null; avg_response_minutes: number | null;
  }>(
    `SELECT pp.id, pp.slug, u.name, u.avatar_url,
            pp.cover_url, pp.cover_position_y,
            pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
            ${taglineSql} as tagline, pp.rating, pp.review_count,
            u.last_seen_at as last_active_at, pp.avg_response_minutes,
            (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as starting_price,
            (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
             FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
            ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs
     FROM photographer_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.is_approved = TRUE
       AND pp.shoot_types && $1::text[]
     ORDER BY pp.is_featured DESC, pp.is_verified DESC, pp.review_count DESC, RANDOM()
     LIMIT 6`,
    [shootType.photographerShootTypeNames || [shootType.name]]
  ).catch(() => []);

  const shootTypeReviews = await getReviewsForShootType(
    shootType.photographerShootTypeNames || [shootType.name],
    6,
    locale,
  );

  // Real packages from photographers offering this shoot type
  const packages = await query<{
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    num_photos: number;
    photographer_slug: string;
    photographer_name: string;
    photographer_avatar: string | null;
    rating: number;
    review_count: number;
  }>(
    `SELECT pk.id, pk.name, pk.price, pk.duration_minutes, pk.num_photos,
            pp.slug as photographer_slug, u.name as photographer_name, u.avatar_url as photographer_avatar,
            pp.rating, pp.review_count
     FROM packages pk
     JOIN photographer_profiles pp ON pp.id = pk.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     JOIN users u ON u.id = pp.user_id
     WHERE pp.is_approved = TRUE AND pk.is_public = TRUE
       AND pp.shoot_types && $1::text[]
     ORDER BY pp.review_count DESC NULLS LAST, pk.price ASC
     LIMIT 6`,
    [shootType.photographerShootTypeNames || [shootType.name]]
  ).catch(() => []);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: stl.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("photoshoots"), href: "/photoshoots" },
          { name: stl.name, href: `/photoshoots/${type}` },
        ]}
      />

      {/* Hero */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {stl.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            {stl.heroText}
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href={`/photographers?shootType=${shootType.slug}`}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("findPhotographers", { name: stl.name })}
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-primary-200 px-8 py-4 text-base font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              {t("howItWorks")}
            </Link>
          </div>
          <div className="mt-8">
            <MatchQuickForm
              presetShootType={shootType.slug}
              source={`photoshoot_${shootType.slug}`}
              size="md"
            />
          </div>
        </div>
      </section>

      {/* Best Locations */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("bestLocationsTitle", { name: stl.name })}
        </h2>
        <p className="mt-4 max-w-3xl text-gray-500">
          {t("bestLocationsSubtitle", { name: stl.name.toLowerCase() })}
        </p>
        <div className={`mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
          shootType.bestLocations.length <= 2 ? "lg:grid-cols-2" :
          shootType.bestLocations.length === 4 ? "lg:grid-cols-2" :
          shootType.bestLocations.length === 3 ? "lg:grid-cols-3" :
          "lg:grid-cols-3"
        }`}>
          {shootType.bestLocations.map((loc) => {
            const location = locations.find((l) => l.slug === loc.slug);
            if (!location) return null;
            return <LocationCard key={loc.slug} location={location} locale={locale} />;
          })}
        </div>
      </section>

      {/* Featured Photographers */}
      {photographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("bestPhotographers", { name: stl.name })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("photographersSubtitle", { name: stl.name.toLowerCase() })}
            </p>
            <div className="mt-6">
              <ScarcityBanner count={photographers.length} locationName={stl.name} locale={locale} context="shootType" />
            </div>
            <div className={`mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
              photographers.length <= 2 ? "lg:grid-cols-2" :
              photographers.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {photographers.map((sp) => (
                <PhotographerCard
                  key={sp.id}
                  photographer={adaptToPhotographerProfile({
                    id: sp.id,
                    slug: sp.slug,
                    name: sp.name,
                    tagline: sp.tagline,
                    avatar_url: sp.avatar_url,
                    cover_url: sp.cover_url,
                    cover_position_y: sp.cover_position_y,
                    portfolio_thumbs: sp.portfolio_thumbs,
                    is_featured: sp.is_featured,
                    is_verified: sp.is_verified,
                    is_founding: sp.is_founding,
                    rating: sp.rating,
                    review_count: sp.review_count,
                    min_price: sp.starting_price,
                    locations: sp.locations,
                    last_active_at: sp.last_active_at,
                    avg_response_minutes: sp.avg_response_minutes,
                  })}
                />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href={`/photographers?shootType=${shootType.slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
              >
                {t("viewAllPhotographers", { name: stl.name })}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="relative overflow-hidden border-y border-warm-200 bg-warm-50">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-primary-100/30 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-accent-100/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("howToBookTitle", { name: stl.name })}
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {[
              {
                title: t("stepBrowse"),
                desc: t("stepBrowseDesc", { name: stl.name.toLowerCase() }),
                iconBg: "bg-primary-500",
                numberBg: "bg-primary-100 text-primary-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
              },
              {
                title: t("stepChoose"),
                desc: t("stepChooseDesc"),
                iconBg: "bg-accent-500",
                numberBg: "bg-accent-50 text-accent-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              },
              {
                title: t("stepBook"),
                desc: t("stepBookDesc"),
                iconBg: "bg-yellow-500",
                numberBg: "bg-yellow-50 text-yellow-700",
                icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></>,
              },
              {
                title: t("stepGetPhotos"),
                desc: t("stepGetPhotosDesc"),
                iconBg: "bg-blue-500",
                numberBg: "bg-blue-50 text-blue-700",
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center lg:px-6">
                {i < 3 && (
                  <div className="absolute left-[calc(50%+32px)] right-[calc(-50%+32px)] top-6 hidden border-t-2 border-dashed border-warm-300 lg:block" />
                )}
                <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl ${item.iconBg} shadow-lg`}>
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.icon}
                  </svg>
                </div>
                <span className={`mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${item.numberBg}`}>
                  {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("faqTitle", { name: stl.name })}
        </h2>
        <div className="mt-8 space-y-4">
          {stl.faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-warm-200 bg-white"
            >
              <summary className="flex items-center justify-between px-6 py-5 font-semibold text-gray-900 cursor-pointer">
                {faq.question}
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5">
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Real packages for this shoot type */}
      {packages.length > 0 && (
        <section className="border-t border-warm-200">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("popularPackages", { name: shootType.name })}
            </h2>
            <p className="mt-3 text-gray-500">
              {t("popularPackagesSub", { nameLower: shootType.name.toLowerCase() })}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Link
                  key={pkg.id}
                  href={`/book/${pkg.photographer_slug}?package=${pkg.id}`}
                  className="group flex flex-col rounded-xl border border-warm-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary-100">
                      {pkg.photographer_avatar && (
                        <OptimizedImage src={pkg.photographer_avatar} alt={normalizeName(pkg.photographer_name)} width={80} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{normalizeName(pkg.photographer_name)}</p>
                      {pkg.review_count > 0 && (
                        <p className="text-xs text-gray-500">★ {Number(pkg.rating).toFixed(1)} · {pkg.review_count} {pkg.review_count === 1 ? tc("review") : tc("reviews")}</p>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-gray-900 group-hover:text-primary-600">{pkg.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {pkg.duration_minutes} {t("minutesAbbr")}
                    {pkg.num_photos > 0 && ` · ${pkg.num_photos} ${t("photosLabel")}`}
                  </p>
                  <div className="mt-auto pt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-gray-900">€{Math.round(Number(pkg.price))}</span>
                    <span className="text-sm font-medium text-primary-600 group-hover:underline">
                      {t("bookCta")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews for this shoot type */}
      {shootTypeReviews.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <ReviewsStrip
              reviews={shootTypeReviews}
              title={t("reviewsTitle", { nameLower: stl.name.toLowerCase() })}
              subtitle={t("reviewsSubtitleClients")}
              compact
            />
          </div>
        </section>
      )}

      {/* Related Blog Posts */}
      {relatedPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {t("guidesTitle", { name: stl.name })}
          </h2>
          <p className="mt-3 text-gray-500">
            {t("guidesSubtitle", { nameLower: stl.name.toLowerCase() })}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:shadow-md"
              >
                {post.cover_image_url && (
                  <div className="aspect-[16/10] overflow-hidden">
                    <OptimizedImage
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white">
            {t("ctaReadyTitle", { name: stl.name })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            {t("ctaReadySubtitle", { name: stl.name.toLowerCase() })}
          </p>
          <Link
            href={`/photographers?shootType=${shootType.slug}`}
            className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
          >
            {t("findPhotographers", { name: stl.name })}
          </Link>
        </div>
      </section>
    </>
  );
}
