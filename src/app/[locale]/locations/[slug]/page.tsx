import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations, getLocationBySlug, getNearbyLocations, locationFaqs } from "@/lib/locations-data";
import { photoSpots } from "@/lib/photo-spots-data";
import { getLocationServices } from "@/lib/location-services-data";
import { locationImage } from "@/lib/unsplash-images";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { queryOne, query } from "@/lib/db";
import { localeAlternates } from "@/lib/seo";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";

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

  // Get real photographer count, average rating, total reviews, and min price for this location
  let photographerCount = 0;
  let avgRating = 0;
  let totalReviews = 0;
  let minPrice: number | null = null;
  try {
    const row = await queryOne<{ count: string; avg_rating: string | null; total_reviews: string; min_price: string | null }>(
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews,
              (SELECT MIN(pk.price) FROM packages pk
               JOIN photographer_locations pl2 ON pl2.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pl2.location_slug = $1 AND pp2.is_approved = TRUE) as min_price
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE`,
      [slug]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
    minPrice = row?.min_price ? parseFloat(row.min_price) : null;
  } catch {}

  // Fetch top photographers for this location (max 6)
  let topPhotographers: {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; tagline: string | null;
    rating: number; review_count: number; starting_price: number | null;
    languages: string[]; location_names: string[];
  }[] = [];
  try {
    topPhotographers = await query<{
      id: string; slug: string; name: string; avatar_url: string | null;
      cover_url: string | null; tagline: string | null;
      rating: number; review_count: number; starting_price: number | null;
      languages: string[]; location_names: string[];
    }>(
      `SELECT pp.id, pp.slug, u.name, u.avatar_url,
              pp.cover_url, pp.tagline, pp.rating, pp.review_count, pp.languages,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id) as starting_price,
              ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id LIMIT 3) as location_names
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
       ORDER BY pp.is_featured DESC, RANDOM()
       LIMIT 6`,
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
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
                      {sp.name}
                    </h3>
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

      {/* Explore Photoshoot Types — internal links to /photoshoots/{type} */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Explore Photoshoot Types in {location.name}
          </h2>
          <p className="mt-2 text-gray-500">
            Learn more about the different photography experiences we offer in {location.name}.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shootTypeLinks.map((st) => (
              <Link
                key={st.slug}
                href={`/photoshoots/${st.slug}`}
                className="flex items-center gap-3 rounded-xl border border-warm-200 bg-warm-50 p-5 transition hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-600">
                    {st.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-primary-600">
                    Learn more &rarr;
                  </p>
                </div>
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
