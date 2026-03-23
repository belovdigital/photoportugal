import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations, getLocationBySlug, getNearbyLocations } from "@/lib/locations-data";
import { photoSpots } from "@/lib/photo-spots-data";
import { getLocationServices } from "@/lib/location-services-data";
import { locationImage } from "@/lib/unsplash-images";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { queryOne, query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";

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

  const seoTitle = locale === "pt" && location.seo_title_pt ? location.seo_title_pt : location.seo_title;
  const seoDescription = locale === "pt" && location.seo_description_pt ? location.seo_description_pt : location.seo_description;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: localeAlternates(`/locations/${slug}`, locale),
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: "website",
      url: `https://photoportugal.com/locations/${slug}`,
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

  const isPt = locale === "pt";
  const description = isPt && location.description_pt ? location.description_pt : location.description;
  const longDescription = isPt && location.long_description_pt ? location.long_description_pt : location.long_description;

  const spots = photoSpots[slug] || [];
  const services = getLocationServices(slug);

  // Get real photographer count, average rating, and total reviews for this location
  let photographerCount = 0;
  let avgRating = 0;
  let totalReviews = 0;
  try {
    const row = await queryOne<{ count: string; avg_rating: string | null; total_reviews: string }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
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
      price: "150",
      url: `https://photoportugal.com/photographers?location=${slug}`,
    },
  };

  const jsonLdLocalBusiness: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
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
              {tc("photographersIn", { location: location.name })}
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
              {photographerCount > 0 && (
                <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                  {photographerCount !== 1
                    ? t("photographersAvailable", { count: photographerCount })
                    : t("photographerAvailable", { count: photographerCount })}
                </span>
              )}
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
                <div>
                  <dt className="text-sm text-gray-500">{t("quickFacts.averageSession")}</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {t("quickFacts.averageSessionValue")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">{t("quickFacts.startingFrom")}</dt>
                  <dd className="text-sm font-semibold text-primary-600">
                    {t("quickFacts.startingFromValue")}
                  </dd>
                </div>
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
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {services.map((service) => (
                <div
                  key={service.shootTypeSlug}
                  className="flex flex-col rounded-xl border border-warm-200 bg-white p-6 shadow-sm transition hover:border-primary-200 hover:shadow-md"
                >
                  <h3 className="text-lg font-bold text-gray-900">
                    {service.label} {t("photoshootIn")} {location.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                    {service.description}
                  </p>
                  <Link
                    href={`/photographers?location=${slug}&shoot=${service.shootTypeSlug}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 transition hover:text-primary-700"
                  >
                    {t("browsePhotographers", { type: service.label.toLowerCase(), location: location.name })}
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {spots.map((spot) => (
                <div
                  key={spot.name}
                  className="rounded-xl border border-warm-200 bg-warm-50 p-5 transition hover:border-primary-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{spot.name}</h3>
                      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{spot.description}</p>
                      {spot.best_time && (
                        <p className="mt-2 text-xs text-gray-400">{t("bestTime", { time: spot.best_time })}</p>
                      )}
                      {spot.tips && (
                        <p className="mt-1 text-xs text-primary-600">{spot.tips}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link
                href={`/photographers?location=${slug}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition"
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
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map((loc) => {
                const nearbyDesc = isPt && loc.description_pt ? loc.description_pt : loc.description;
                return (
                  <Link
                    key={loc.slug}
                    href={`/locations/${loc.slug}`}
                    className="group rounded-xl border border-warm-200 bg-white p-6 transition hover:border-primary-200 hover:shadow-md"
                  >
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                      {loc.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {nearbyDesc}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                      {t("viewPhotographersLink")}
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                );
              })}
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
