import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations, getLocationBySlug, getNearbyLocations, locationFaqs, locField } from "@/lib/locations-data";
import { photoSpots } from "@/lib/photo-spots-data";
import { getLocationServices } from "@/lib/location-services-data";
import { locationImage, unsplashUrl } from "@/lib/unsplash-images";

const SHOOT_TYPE_IMAGES: Record<string, string> = {
  couples: "photo-1529634597503-139d3726fed5",
  family: "photo-1609220136736-443140cffec6",
  proposal: "photo-1515934751635-c81c6bc9a2d8",
  honeymoon: "photo-1519741497674-611481863552",
  elopement: "photo-1532712938310-34cb3982ef74",
  solo: "photo-1494790108377-be9c29b29330",
  engagement: "photo-1522673607200-164d1b6ce486",
  friends: "photo-1529156069898-49953e39b3ac",
  wedding: "photo-1606216794079-73f85bbd57d5",
};
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { queryOne, query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { ActiveBadge, ResponseTimeBadge } from "@/components/ui/ActiveBadge";
import { LocationCard } from "@/components/ui/LocationCard";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForLocation } from "@/lib/reviews-data";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { spotSlug, spotLocalized } from "@/lib/photo-spots-data";
import { formatDuration } from "@/lib/package-pricing";

export function generateStaticParams() {
  return locations.map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const location = getLocationBySlug(slug);
  if (!location) return {};

  const seoTitle = locField(location, "seo_title", locale) || location.seo_title;
  const seoDescription = locField(location, "seo_description", locale) || location.seo_description;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: localeAlternates(`/locations/${slug}`, locale),
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: "website",
      url: `https://photoportugal.com/locations/${slug}`,
      images: [{ url: location.cover_image || "/og-image.png", width: 1200, height: 630, alt: `${location.name}, Portugal` }],
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("locations.detail");
  const tc = await getTranslations("common");

  const location = getLocationBySlug(slug);

  if (!location) {
    notFound();
  }

  const nearby = getNearbyLocations(slug);

  const description = locField(location, "description", locale) || location.description;
  const longDescription = locField(location, "long_description", locale) || location.long_description;
  const localizedName = locField(location, "name", locale) || location.name;

  const spots = photoSpots[slug] || [];
  const services = getLocationServices(slug);

  // Get real photographer count, average rating, total reviews, min price and session duration range for this location
  let photographerCount = 0;
  let avgRating = 0;
  let totalReviews = 0;
  let minPrice: number | null = null;
  let minDuration: number | null = null;
  let maxDuration: number | null = null;
  try {
    const row = await queryOne<{
      count: string; avg_rating: string | null; total_reviews: string;
      min_price: string | null; min_duration: string | null; max_duration: string | null;
    }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews,
              (SELECT MIN(pk.price) FROM packages pk
               JOIN photographer_locations pl2 ON pl2.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pl2.location_slug = $1 AND pp2.is_approved = TRUE AND pk.is_public = TRUE) as min_price,
              (SELECT MIN(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl3 ON pl3.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp3 ON pp3.id = pk.photographer_id
               WHERE pl3.location_slug = $1 AND pp3.is_approved = TRUE AND pk.is_public = TRUE AND pk.duration_minutes IS NOT NULL) as min_duration,
              (SELECT MAX(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl4 ON pl4.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp4 ON pp4.id = pk.photographer_id
               WHERE pl4.location_slug = $1 AND pp4.is_approved = TRUE AND pk.is_public = TRUE AND pk.duration_minutes IS NOT NULL) as max_duration
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
    minPrice = row?.min_price ? parseFloat(row.min_price) : null;
    minDuration = row?.min_duration ? parseInt(row.min_duration) : null;
    maxDuration = row?.max_duration ? parseInt(row.max_duration) : null;
  } catch {}

  // Format duration range: "60 min", "1 hour", "1-2 hours", "90 min-2 hours" etc.
  const fmt = (min: number) => formatDuration(min, locale);
  const durationText = minDuration && maxDuration
    ? (minDuration === maxDuration ? fmt(minDuration) : `${fmt(minDuration)} – ${fmt(maxDuration)}`)
    : null;

  // Fetch top photographers for this location (max 6)
  let topPhotographers: {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; tagline: string | null;
    rating: number; review_count: number; starting_price: number | null;
    languages: string[]; location_names: string[];
    last_active_at: string | null; avg_response_minutes: number | null;
  }[] = [];
  try {
    topPhotographers = await query<{
      id: string; slug: string; name: string; avatar_url: string | null;
      cover_url: string | null; tagline: string | null;
      rating: number; review_count: number; starting_price: number | null;
      languages: string[]; location_names: string[];
      last_active_at: string | null; avg_response_minutes: number | null;
    }>(
      (() => {
        const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
        const useLoc = TR_LOCALES.has(locale) ? locale : null;
        const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
        return `SELECT pp.id, pp.slug, u.name, u.avatar_url,
              pp.cover_url, ${taglineSql} as tagline, pp.rating, pp.review_count, pp.languages,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as starting_price,
              ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id LIMIT 3) as location_names
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
       ORDER BY pp.is_featured DESC, RANDOM()
       LIMIT 6`;
      })(),
      [slug]
    );
  } catch {}

  // Fetch related blog posts that mention this location
  let relatedPosts: { id: string; slug: string; title: string; excerpt: string | null; cover_image_url: string | null; published_at: string }[] = [];
  try {
    relatedPosts = await query<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      cover_image_url: string | null;
      published_at: string;
    }>(
      `SELECT id, slug, title, excerpt, cover_image_url, published_at
       FROM blog_posts
       WHERE is_published = TRUE
       AND (title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%' OR meta_description ILIKE '%' || $1 || '%')
       ORDER BY published_at DESC
       LIMIT 3`,
      [location.name]
    );
  } catch {}

  const jsonLdDestination = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: `${location.name}, Portugal`,
    description: description,
    geo: {
      "@type": "GeoCoordinates",
      latitude: location.lat,
      longitude: location.lng,
    },
  };

  const jsonLdService = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Vacation Photography",
    provider: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    areaServed: {
      "@type": "City",
      name: location.name,
      containedInPlace: {
        "@type": "Country",
        name: "Portugal",
      },
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: String(minPrice ?? 150),
      url: `https://photoportugal.com/photographers?location=${slug}`,
    },
  };

  const jsonLdLocalBusiness: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "ProfessionalService"],
    name: `Photo Portugal — ${location.name}`,
    description: description,
    url: `https://photoportugal.com/locations/${slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: location.name,
      addressCountry: "PT",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: location.lat,
      longitude: location.lng,
    },
    priceRange: "$$",
    image: location.cover_image?.startsWith("http") ? location.cover_image : `https://photoportugal.com${location.cover_image}`,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `Photography Services in ${location.name}`,
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: `Couples Photoshoot in ${location.name}` } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: `Family Photoshoot in ${location.name}` } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: `Proposal Photography in ${location.name}` } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: `Solo Travel Photoshoot in ${location.name}` } },
      ],
    },
    sameAs: [
      "https://www.instagram.com/photoportugal_com",
    ],
  };

  if (totalReviews > 0 && avgRating > 0) {
    jsonLdLocalBusiness.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount: totalReviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const faqs = locationFaqs[slug] || [];
  const jsonLdFaq = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } : null;

  const locationReviews = await getReviewsForLocation(slug, 6, locale);

  // Shoot types available for internal linking
  const shootTypeLinks = [
    { slug: "couples", label: "Couples Photoshoots" },
    { slug: "family", label: "Family Photoshoots" },
    { slug: "proposal", label: "Proposal Photoshoots" },
    { slug: "solo", label: "Solo Portrait Photoshoots" },
    { slug: "engagement", label: "Engagement Photoshoots" },
    { slug: "honeymoon", label: "Honeymoon Photoshoots" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdDestination) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdService) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLocalBusiness) }}
      />
      {jsonLdFaq && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
      )}

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("locations"), href: "/locations" },
          { name: location.name, href: `/locations/${slug}` },
        ]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <OptimizedImage
            src={locationImage(location.slug, "hero")}
            alt={`Vacation photography session in ${location.name}, Portugal`}
            priority
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950/85 via-primary-900/70 to-primary-800/50" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary-300">
              {location.region}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              {tc("photographersIn", { location: localizedName })}
            </h1>
            <p className="mt-6 text-lg text-primary-100/90">
              {description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={`/photographers?location=${location.slug}`}
                className="inline-flex rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50 hover:shadow-xl"
              >
                {t("viewPhotographers", { location: location.name })}
              </Link>
              {photographerCount >= 6 && (
                <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                  {t("photographersAvailable", { count: photographerCount })}
                </span>
              )}
            </div>
            <div className="mt-6 max-w-xl">
              <MatchQuickForm
                presetLocation={location.slug}
                source={`location_${location.slug}`}
                variant="dark"
                size="md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* About the location */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("whyLocation", { location: location.name })}
            </h2>
            <div className="mt-6 text-gray-600 leading-relaxed space-y-4">
              <p>{longDescription}</p>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold text-gray-900">
                {t("popularTypes", { location: location.name })}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["couples", "family", "soloPortrait", "engagement", "proposal", "honeymoon", "friendsTrip", "anniversary"] as const).map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700"
                  >
                    {t(`shootTypes.${type}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">{t("quickFacts.title")}</h3>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">{t("quickFacts.region")}</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {location.region}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">{t("quickFacts.bestTimeForPhotos")}</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {t("quickFacts.bestTimeValue")}
                  </dd>
                </div>
                {durationText && (
                  <div>
                    <dt className="text-sm text-gray-500">{t("quickFacts.averageSession")}</dt>
                    <dd className="text-sm font-semibold text-gray-900">{durationText}</dd>
                  </div>
                )}
                {minPrice !== null && (
                  <div>
                    <dt className="text-sm text-gray-500">{t("quickFacts.startingFrom")}</dt>
                    <dd className="text-sm font-semibold text-primary-600">€{Math.round(minPrice)} / session</dd>
                  </div>
                )}
              </dl>
              <Link
                href={`/photographers?location=${location.slug}`}
                className="mt-6 block w-full rounded-xl bg-primary-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                {tc("findPhotographers")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Photographers */}
      {topPhotographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("topPhotographers", { location: location.name })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("dedicatedPhotographers", { location: location.name })}
            </p>
            <div className="mt-6">
              <ScarcityBanner count={photographerCount} locationName={location.name} locale={locale} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {topPhotographers.map((sp) => (
                <Link
                  key={sp.id}
                  href={`/photographers/${sp.slug}`}
                  className="group overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:border-primary-200 hover:shadow-md"
                >
                  {/* Cover */}
                  <div className="relative h-36 bg-warm-100">
                    {sp.cover_url ? (
                      <OptimizedImage src={sp.cover_url} alt={sp.name} width={400} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-warm-100 to-warm-200" />
                    )}
                    <div className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-sm font-bold text-primary-600 overflow-hidden shadow-sm">
                      {sp.avatar_url ? (
                        <OptimizedImage src={sp.avatar_url} alt={sp.name} width={80} className="h-full w-full object-cover" />
                      ) : (
                        sp.name.charAt(0)
                      )}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-4 pb-4 pt-7">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
                        {sp.name}
                      </h3>
                      <ActiveBadge lastSeenAt={sp.last_active_at} />
                    </div>
                    {sp.tagline && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{sp.tagline}</p>
                    )}
                    {sp.review_count > 0 ? (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <span className="text-amber-500">
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                      <span className="font-semibold text-gray-900">{Number(sp.rating).toFixed(1)}</span>
                      <span className="text-gray-400">({sp.review_count})</span>
                    </div>
                    ) : null}
                    <ResponseTimeBadge avgMinutes={sp.avg_response_minutes} compact />
                    {sp.location_names.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sp.location_names.map((loc) => (
                          <span key={loc} className="rounded-full bg-warm-100 px-2 py-0.5 text-[10px] text-gray-500 capitalize">{loc.replace(/-/g, " ")}</span>
                        ))}
                      </div>
                    )}
                    {sp.starting_price && (
                      <p className="mt-2 text-sm">
                        <span className="text-gray-400">{tc("from")}</span>{" "}
                        <span className="font-bold text-gray-900">&euro;{Math.round(Number(sp.starting_price))}</span>
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {photographerCount > topPhotographers.length && (
              <div className="mt-8 text-center">
                <Link
                  href={`/photographers?location=${slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 hover:shadow-md"
                >
                  {t("viewPhotographers", { location: location.name })}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reviews from photographers in this location */}
      {locationReviews.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <ReviewsStrip
              reviews={locationReviews}
              title={`What travelers say about photoshoots in ${location.name}`}
              subtitle="Real reviews from verified bookings"
              compact
            />
          </div>
        </section>
      )}

      {/* How It Works */}
      <HowItWorksSection />

      {/* Popular Photoshoot Types */}
      {services.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("popularTypesSection", { location: location.name })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("dedicatedPhotographers", { location: location.name })}
            </p>
            <div className={`mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
              services.length <= 2 ? "lg:grid-cols-2" :
              services.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {services.map((service) => {
                const imgId = SHOOT_TYPE_IMAGES[service.shootTypeSlug];
                return (
                  <Link
                    key={service.shootTypeSlug}
                    href={`/photographers?location=${slug}&shoot=${service.shootTypeSlug}`}
                    className="group relative overflow-hidden rounded-2xl bg-gray-900 shadow-lg transition hover:shadow-xl"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      {imgId ? (
                        <OptimizedImage
                          src={unsplashUrl(imgId, 400)}
                          alt={`${service.label} photoshoot in ${location.name}`}
                          width={400}
                          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-700" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="font-display text-xl font-bold text-white">
                        {service.label} {t("photoshootIn")} {location.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-200 line-clamp-2">
                        {service.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Explore Photoshoot Types — compact internal links for SEO */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Explore:</span>
            {shootTypeLinks.map((st) => (
              <Link
                key={st.slug}
                href={`/photoshoots/${st.slug}`}
                className="rounded-full border border-warm-200 bg-warm-50 px-4 py-1.5 text-sm font-medium text-gray-600 transition hover:border-primary-300 hover:text-primary-600"
              >
                {st.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top Photo Spots */}
      {spots.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("topPhotoSpots", { location: location.name })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("mostPhotogenic", { location: location.name })}
            </p>
            <div className={`mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              spots.length <= 2 ? "lg:grid-cols-2" :
              spots.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {spots.map((spot) => {
                const sl = spotLocalized(spot, locale);
                return (
                  <Link
                    key={spot.name}
                    href={`/spots/${slug}/${spotSlug(spot.name)}`}
                    className="group rounded-xl border border-warm-200 bg-warm-50 p-5 transition hover:border-primary-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{sl.name}</h3>
                        <p className="mt-1 text-sm text-gray-500 leading-relaxed">{sl.description}</p>
                        {sl.best_time && (
                          <p className="mt-2 text-xs text-gray-400">{t("bestTime", { time: sl.best_time })}</p>
                        )}
                        {sl.tips && (
                          <p className="mt-1 text-xs text-primary-600">{sl.tips}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-10 text-center">
              <Link
                href={`/photographers?location=${slug}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
              >
                {t("findPhotographersAtSpots")}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section — only for top locations with FAQ data */}
      {faqs.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              Frequently Asked Questions About Photography in {location.name}
            </h2>
            <div className="mt-8 space-y-4">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-warm-200 bg-warm-50"
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
          </div>
        </section>
      )}

      {/* Nearby Locations */}
      {nearby.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              {t("nearbyLocations")}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("exploreMore", { location: location.name })}
            </p>
            <div className={`mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 ${
              nearby.length <= 2 ? "lg:grid-cols-2" :
              nearby.length === 4 ? "lg:grid-cols-2" :
              "lg:grid-cols-3"
            }`}>
              {nearby.map((loc) => (
                <LocationCard key={loc.slug} location={loc} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              {t("relatedArticles")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group rounded-xl border border-warm-200 bg-warm-50 overflow-hidden transition hover:border-primary-200 hover:shadow-md"
                >
                  {post.cover_image_url && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <OptimizedImage
                        src={post.cover_image_url}
                        alt={post.title}
                        width={400}
                        className="h-full w-full transition group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition line-clamp-2">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                      {t("readMore")}
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <OptimizedImage
            src={locationImage(location.slug, "card")}
            alt={`Professional vacation photoshoot in ${location.name}, Portugal`}
            width={600}
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {t("cta.title", { location: location.name })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            {t("cta.subtitle")}
          </p>
          <Link
            href={`/photographers?location=${location.slug}`}
            className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
          >
            {t("cta.browsePhotographers", { location: location.name })}
          </Link>
        </div>
      </section>
    </>
  );
}
