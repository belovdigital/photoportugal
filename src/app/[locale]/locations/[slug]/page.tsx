import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locations, getLocationBySlug, getNearbyLocations, locationFaqs, locField, faqField } from "@/lib/locations-data";
import { localizeShootType } from "@/lib/shoot-type-labels";
import { photoSpots } from "@/lib/photo-spots-data";
import { getLocationServices, serviceDescription } from "@/lib/location-services-data";
import { locationImage, unsplashUrl, IMAGE_SIZES } from "@/lib/unsplash-images";

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
import { PhotographerCardCompact } from "@/components/ui/PhotographerCardCompact";
import { PackageCardWithCarousel } from "@/components/ui/PackageCardWithCarousel";
import { LocationCard } from "@/components/ui/LocationCard";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForLocation } from "@/lib/reviews-data";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { spotSlug, spotLocalized } from "@/lib/photo-spots-data";
import { formatDuration } from "@/lib/package-pricing";
import { HeroSingleVariant, type HeroFeaturedPhotographer, type HeroLocationContext } from "@/components/ui/HeroSingleVariant";
import { PortfolioMosaic } from "@/components/ui/PortfolioMosaic";
import { LocationPhotosMasonry, type LocationMasonryPhoto } from "@/components/ui/LocationPhotosMasonry";
import { LocationStickyBookBar } from "@/components/ui/LocationStickyBookBar";

export function generateStaticParams() {
  return locations.map((loc) => ({ slug: loc.slug }));
}

// Force-dynamic so the random hero photographer reshuffles on every request
// rather than staying frozen at whichever person was picked at build/ISR time.
// These are paid-ad landing pages — SEO weight is lower, the freshness signal
// (different photographer in hero each visit) is the conversion lever.
export const dynamic = "force-dynamic";

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
      // Strict: only photographers who have at least one portfolio
      // photo tagged with this location count toward the "N
      // photographers in Sintra" headline + price/duration bounds.
      // Listing someone who's never shot here misleads the visitor.
      `SELECT COUNT(DISTINCT pp.id) as count,
              AVG(pp.rating) FILTER (WHERE pp.rating IS NOT NULL AND pp.review_count > 0) as avg_rating,
              COALESCE(SUM(pp.review_count), 0) as total_reviews,
              (SELECT MIN(pk.price) FROM packages pk
               JOIN photographer_locations pl2 ON pl2.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pl2.location_slug = $1 AND pp2.is_approved = TRUE AND pk.is_public = TRUE
                 AND EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp2.id AND pi.type = 'photo' AND pi.location_slug = $1)) as min_price,
              (SELECT MIN(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl3 ON pl3.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp3 ON pp3.id = pk.photographer_id
               WHERE pl3.location_slug = $1 AND pp3.is_approved = TRUE AND pk.is_public = TRUE AND pk.duration_minutes IS NOT NULL
                 AND EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp3.id AND pi.type = 'photo' AND pi.location_slug = $1)) as min_duration,
              (SELECT MAX(pk.duration_minutes) FROM packages pk
               JOIN photographer_locations pl4 ON pl4.photographer_id = pk.photographer_id
               JOIN photographer_profiles pp4 ON pp4.id = pk.photographer_id
               WHERE pl4.location_slug = $1 AND pp4.is_approved = TRUE AND pk.is_public = TRUE AND pk.duration_minutes IS NOT NULL
                 AND EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp4.id AND pi.type = 'photo' AND pi.location_slug = $1)) as max_duration
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
         AND EXISTS (
           SELECT 1 FROM portfolio_items pi
            WHERE pi.photographer_id = pp.id
              AND pi.type = 'photo'
              AND pi.location_slug = $1
         )`,
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

  // Hero photographer — weighted-random pick filtered to this location.
  // Same Efraimidis-Spirakis pattern as the homepage hero so featured /
  // verified / founding people get more carousel time, but the pool is
  // restricted to people who actually cover this location.
  let heroPhotographer: HeroFeaturedPhotographer | null = null;
  try {
    const heroRows = await query<{
      slug: string; name: string; tagline: string | null;
      cover_url: string | null; avatar_url: string | null;
      rating: string; review_count: number; session_count: number;
      portfolio_urls: string[] | null;
    }>(
      (() => {
        const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
        const useLoc = TR_LOCALES.has(locale) ? locale : null;
        const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
        // Strict: photographer can only be the location hero if they
        // have at least one portfolio_item.location_slug = $1. Without
        // this, e.g. Achitei (covers Sintra in photographer_locations
        // but has zero Sintra-tagged shots) would surface and the
        // carousel would show his Cascais/Lisbon work — misleading on
        // a /locations/sintra page. Featured/verified/founding weights
        // still apply within the qualifying pool.
        // The portfolio_urls subquery also surfaces sintra-tagged
        // photos first so the carousel leads with on-location work.
        return `SELECT pp.slug, u.name, ${taglineSql} as tagline, pp.cover_url, u.avatar_url,
              COALESCE(pp.rating, 0)::text as rating,
              COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pp.session_count, 0) as session_count,
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                ORDER BY
                  CASE WHEN pi.location_slug = $1 THEN 0 ELSE 1 END,
                  pi.sort_order NULLS LAST, pi.created_at
                LIMIT 12
              ) as portfolio_urls
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND EXISTS (
           SELECT 1 FROM portfolio_items pi
            WHERE pi.photographer_id = pp.id
              AND pi.type = 'photo'
              AND pi.location_slug = $1
         )
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 1`;
      })(),
      [slug]
    );
    if (heroRows.length > 0) {
      const r = heroRows[0];
      heroPhotographer = {
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        cover_url: r.cover_url,
        avatar_url: r.avatar_url,
        rating: Number(r.rating),
        review_count: r.review_count,
        session_count: r.session_count,
        location_name: localizedName,
        location_slug: slug,
        portfolio_urls: (r.portfolio_urls || []).filter(Boolean),
      };
    }
  } catch {}

  // Pool of portfolio photos from this location for the mosaic in section 2
  // AND the masonry block 3. Single query, weighted tier sampling (same
  // shape as the homepage). Filter at portfolio_items level by
  // location_slug, falling back to "any photo by photographers covering
  // this city" so locations without per-photo tags still get content.
  type LocationPortfolioRow = {
    url: string; width: number | null; height: number | null;
    slug: string; name: string; avatar_url: string | null;
  };
  let locationMosaicPhotos: { url: string; slug: string; name: string; location: string | null }[] = [];
  let locationMasonryPhotos: LocationMasonryPhoto[] = [];
  try {
    const portfolioRows = await query<LocationPortfolioRow>(
      `SELECT pi.url, pi.width, pi.height,
              pp.slug, u.name, u.avatar_url
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       JOIN photographer_locations pl ON pl.photographer_id = pp.id
       WHERE pl.location_slug = $1
         AND pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND (pi.location_slug IS NULL OR pi.location_slug = $1)
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 60`,
      [slug]
    );
    locationMosaicPhotos = portfolioRows.slice(0, 24).map((r) => ({
      url: r.url, slug: r.slug, name: r.name, location: localizedName,
    }));
    // Block 3 masonry — capped at 30 so the mobile peek-carousel stays
    // navigable but visitors still get plenty of variety. Includes
    // width/height + avatar for the desktop hover attribution overlay.
    locationMasonryPhotos = portfolioRows.slice(0, 30).map((r) => ({
      url: r.url,
      width: r.width,
      height: r.height,
      photographer: { slug: r.slug, name: r.name, avatar_url: r.avatar_url },
    }));
  } catch {}

  // Total photographers across Portugal — for the "browse all N" link in
  // the hero overlay (which links to the catalog, not just this location).
  let totalPhotographers = 0;
  try {
    const totalRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM photographer_profiles
       WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
    );
    totalPhotographers = totalRow?.count ?? 0;
  } catch {}

  const heroLocationContext: HeroLocationContext = {
    slug,
    name: localizedName,
    region: location.region,
    photographerCount,
    minPrice,
    durationText,
    avgRating: avgRating || null,
    totalReviews,
  };

  // Fetch top photographers for this location (max 6). Pull the full set of
  // fields PhotographerCardCompact expects so this page renders the same rich
  // card as the homepage Top Photographers section.
  type LocationPhotographerRow = {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null;
    rating: number; review_count: number; starting_price: string | null;
    locations: string | null;
    last_active_at: string | null; avg_response_minutes: number | null;
    packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number }[] | null;
    packages_count: number;
  };
  let topPhotographers: LocationPhotographerRow[] = [];
  try {
    topPhotographers = await query<LocationPhotographerRow>(
      (() => {
        const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
        const useLoc = TR_LOCALES.has(locale) ? locale : null;
        const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
        return `SELECT pp.id, pp.slug, u.name, u.avatar_url,
              pp.cover_url, pp.cover_position_y,
              pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
              ${taglineSql} as tagline, pp.rating, pp.review_count,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as starting_price,
              (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
              ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs,
              -- ALL public packages (no LIMIT) so the card can render the
              -- full stack inline — most photographers have 3–4 and a
              -- "view all" link would just add a click without saving
              -- vertical space. Card needs id/name/price/duration/num_photos
              -- per row.
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'id', pk.id,
                    'name', pk.name,
                    'price', pk.price,
                    'duration_minutes', pk.duration_minutes,
                    'num_photos', COALESCE(pk.num_photos, 0)
                  ) ORDER BY pk.sort_order NULLS LAST, pk.price ASC
                )
                FROM packages pk
                WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE
              ), '[]'::json) as packages,
              -- Kept for back-compat (not displayed) — could be removed.
              (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::int as packages_count
       FROM photographer_locations pl
       JOIN photographer_profiles pp ON pp.id = pl.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pl.location_slug = $1 AND pp.is_approved = TRUE
         AND EXISTS (
           SELECT 1 FROM portfolio_items pi
            WHERE pi.photographer_id = pp.id
              AND pi.type = 'photo'
              AND pi.location_slug = $1
         )
       ORDER BY pp.is_featured DESC, pp.is_verified DESC, RANDOM()
       LIMIT 6`;
      })(),
      [slug]
    );
  } catch {}

  // Featured packages — top 6 bookable packages at this location, ranked
  // by photographer quality + popular flag + price ascending. These get
  // promoted to first content under the hero so the page reads as
  // "buy a photoshoot" first, "pick a photographer" second. Each row is
  // pre-bookable via /book/[slug]?package=ID — no provider-pick step.
  // One package per photographer (DISTINCT ON via window) so the grid
  // doesn't fill up with 6 packages from the same person on locations
  // where one photographer dominates. Photo carousel order is
  // hash-shuffled per package_id so two cards from the same photographer
  // don't start on the same cover photo.
  const featuredPackages = await query<{
    id: string; name: string; price: string; duration_minutes: number; num_photos: number;
    photographer_slug: string; photographer_name: string; photographer_avatar: string | null;
    rating: number; review_count: number; is_popular: boolean;
    portfolio_thumbs: string[];
  }>(
    `WITH per_photographer AS (
       SELECT pk.id, pk.name, pk.price::text AS price, pk.duration_minutes,
              COALESCE(pk.num_photos, 0) as num_photos,
              pp.id as profile_id,
              pp.slug as photographer_slug, u.name as photographer_name,
              u.avatar_url as photographer_avatar,
              COALESCE(pp.rating, 0) as rating, COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pk.is_popular, FALSE) as is_popular,
              pp.is_featured, pp.is_verified,
              ROW_NUMBER() OVER (
                PARTITION BY pp.id
                ORDER BY COALESCE(pk.is_popular, FALSE) DESC,
                         pk.price ASC
              ) as rn_per_photographer
         FROM packages pk
         JOIN photographer_profiles pp ON pp.id = pk.photographer_id
         JOIN users u ON u.id = pp.user_id
         JOIN photographer_locations pl ON pl.photographer_id = pp.id
        WHERE pl.location_slug = $1
          AND pp.is_approved = TRUE
          AND COALESCE(pp.is_test, FALSE) = FALSE
          AND pk.is_public = TRUE
          -- Strict: photographer must have at least one portfolio photo
          -- tagged with this location, otherwise we end up promoting a
          -- "Porto Photoshoot" package on /locations/sintra because the
          -- photographer happens to also list Sintra as a covered area.
          AND EXISTS (
            SELECT 1 FROM portfolio_items pi
             WHERE pi.photographer_id = pp.id
               AND pi.type = 'photo'
               AND pi.location_slug = $1
          )
     )
     SELECT id, name, price, duration_minutes, num_photos,
            photographer_slug, photographer_name, photographer_avatar,
            rating, review_count, is_popular,
            COALESCE((
              SELECT array_agg(url ORDER BY rank, shuffle, sort_order NULLS LAST, created_at)
                FROM (
                  SELECT pi.url,
                         CASE WHEN pi.location_slug = $1 THEN 0 ELSE 1 END as rank,
                         hashtext(pp.id::text || pi.url) as shuffle,
                         pi.sort_order, pi.created_at
                    FROM portfolio_items pi
                   WHERE pi.photographer_id = pp.profile_id
                     AND pi.type = 'photo'
                   ORDER BY rank, shuffle, pi.sort_order NULLS LAST, pi.created_at
                   LIMIT 5
                ) ranked
            ), ARRAY[]::text[]) as portfolio_thumbs
       FROM per_photographer pp
      WHERE rn_per_photographer = 1
      ORDER BY pp.is_featured DESC, pp.is_verified DESC,
               pp.is_popular DESC NULLS LAST,
               pp.rating DESC NULLS LAST,
               pp.price ASC
      LIMIT 6`,
    [slug]
  ).catch(() => []);

  // Fetch related blog posts that mention this location AND are in the
  // visitor's current locale. Without the locale filter the Spanish or
  // French page was rendering German posts (the only locale where the
  // location was mentioned), which read as broken. If no posts exist in
  // the current locale, the section silently hides — better than showing
  // mismatched language.
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
       AND COALESCE(locale, 'en') = $2
       AND (title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%' OR meta_description ILIKE '%' || $1 || '%')
       ORDER BY published_at DESC
       LIMIT 3`,
      [location.name, locale]
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
  const localizedFaqs = faqs.map((faq) => ({
    question: faqField(faq, "question", locale),
    answer: faqField(faq, "answer", locale),
  }));
  const jsonLdFaq = localizedFaqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: localizedFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } : null;

  const locationReviews = await getReviewsForLocation(slug, 6, locale);

  // Shoot types available for internal linking — localized via shoot-type-labels
  const shootTypeLinks = [
    { slug: "couples", canonical: "Couples" },
    { slug: "family", canonical: "Family" },
    { slug: "proposal", canonical: "Proposal" },
    { slug: "solo", canonical: "Solo Portrait" },
    { slug: "engagement", canonical: "Engagement" },
    { slug: "honeymoon", canonical: "Honeymoon" },
  ].map((s) => ({ slug: s.slug, label: t("shootTypeCardLabel", { type: localizeShootType(s.canonical, locale) }) }));

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

      {/* Mobile-only sticky bottom CTA bar. Renders independently of the
          page flow (fixed position) and shows after the user has scrolled
          past the hero so it doesn't compete with the hero's MatchQuickForm. */}
      <LocationStickyBookBar
        locationSlug={slug}
        locationName={localizedName}
        minPrice={minPrice}
      />

      {/* Hero — same single-photographer carousel pattern as the homepage,
          but the photographer is filtered to people who cover THIS location.
          The overlay text + chips switch to "Photographers in {location}"
          framing via the locationContext prop. */}
      {heroPhotographer ? (
        <HeroSingleVariant
          photographer={heroPhotographer}
          locationContext={heroLocationContext}
          totalPhotographers={totalPhotographers}
        />
      ) : (
        // Fallback when no photographer covers this location yet — keep the
        // old static-image hero so the page never renders empty.
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
              <p className="text-sm font-semibold text-primary-300">{location.region}</p>
              <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                {tc("photographersIn", { location: localizedName })}
              </h1>
              <p className="mt-6 text-lg text-primary-100/90">{description}</p>
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
      )}

      {/* Featured packages — first content under hero so the page reads
          as "buy a photoshoot" first, "pick a photographer" second. Each
          card is a complete buyable thing: price, duration, photo count,
          photographer + rating, "Book this package" CTA going straight
          to /book/[slug]?package=ID (no extra provider-pick step).
          Mobile-first: 1 col on phones, 2 on sm, 3 on lg. */}
      {featuredPackages.length > 0 && (
        <section id="packages" className="border-b border-warm-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                {t("packagesHeading", { location: localizedName })}
              </h2>
              <p className="mt-3 text-gray-500">{t("packagesSub")}</p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPackages.map((pkg) => (
                <PackageCardWithCarousel
                  key={pkg.id}
                  pkg={pkg}
                  popularLabel={t("packagePopular")}
                  minutesAbbrLabel={t("packageMinutesAbbr")}
                  photosLabel={t("packagePhotos")}
                  bookCtaLabel={t("packageBookCta")}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About the location — sticky left text + scroll-snap mosaic on the
          right (same pattern as the homepage section 2). Quick facts moved
          into the hero as chips, so this section is purely "why X +
          shoot-type tags + see what people shoot here". */}
      <section className="relative bg-warm-50">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* `items-start` is required for sticky to work — default
              `items-stretch` would equalise column heights and the sticky
              effect would silently die. */}
          <div className="grid grid-cols-1 items-start gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            {/* Left — text/CTAs, sticks to top while user scrolls past the
                mosaic. */}
            <div className="max-w-xl lg:sticky lg:top-24">
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                {t("whyLocation", { location: location.name })}
              </h2>
              <div className="mt-6 text-gray-600 leading-relaxed space-y-4">
                <p>{longDescription}</p>
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {t("popularTypes", { location: location.name })}
                </h3>
                {/* Pills now route into the /locations/[slug]/[occasion]
                    combo pages — e.g. "Couples" on /lisbon goes to a real
                    "Couples Photographer in Lisbon" page, not just a
                    decorative tag. The mapping below converts the
                    translation key (camelCase) to the combo URL slug
                    (lowercase, hyphenated) since the two namespaces drift. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    { key: "couples", combo: "couples" },
                    { key: "family", combo: "family" },
                    { key: "soloPortrait", combo: "solo" },
                    { key: "engagement", combo: "engagement" },
                    { key: "proposal", combo: "proposal" },
                    { key: "honeymoon", combo: "honeymoon" },
                    { key: "elopement", combo: "elopement" },
                  ] as const).map(({ key, combo }) => (
                    <Link
                      key={key}
                      href={`/locations/${location.slug}/${combo}`}
                      className="rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-100 hover:text-primary-800"
                    >
                      {t(`shootTypes.${key}`)}
                    </Link>
                  ))}
                </div>
              </div>

              <Link
                href={`/photographers?location=${location.slug}`}
                className="mt-8 inline-flex rounded-xl bg-primary-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
              >
                {tc("findPhotographers")}
              </Link>
            </div>

            {/* Right — auto-rotating mosaic of real portfolio photos from
                this location. Tall (140vh) so the user has room to scroll
                past it while the left column stays sticky. */}
            <div className="hidden lg:block lg:h-[140vh]">
              {locationMosaicPhotos.length > 0 && (
                <PortfolioMosaic photos={locationMosaicPhotos.slice(0, 24)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Block 3 — Real photos shot in this location with photographer
          attribution. Mobile is a peek-carousel (mixed orientations), desktop
          is a 3-col masonry. Click on any photo opens the photographer's
          profile in a new tab. */}
      {locationMasonryPhotos.length > 0 && (
        <LocationPhotosMasonry photos={locationMasonryPhotos} />
      )}

      {/* Featured Photographers */}
      {topPhotographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("chooseYourPhotographerHeading")}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("chooseYourPhotographerSub", { location: location.name })}
            </p>
            <div className="mt-6">
              <ScarcityBanner count={photographerCount} locationName={location.name} locale={locale} />
            </div>
            {/* Switched from <PhotographerCard> to <PhotographerCardCompact>
                so this page can render inline package CTAs (top 2 packages
                + "View all N more" link) — same pattern as the LP cards.
                On a paid-ad landing this shortens the funnel by a click:
                visitor sees price + duration upfront, taps a package, lands
                on /book/{slug}?package={id} directly. */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {topPhotographers.map((sp) => (
                <PhotographerCardCompact
                  key={sp.id}
                  p={{
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
                    rating: Number(sp.rating),
                    review_count: sp.review_count,
                    min_price: sp.starting_price ? Number(sp.starting_price) : null,
                    locations: sp.locations,
                    last_active_at: sp.last_active_at,
                    avg_response_minutes: sp.avg_response_minutes,
                    packages: sp.packages ?? [],
                    packages_total_count: sp.packages_count,
                  }}
                />
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
              title={t("whatTravelersSay", { location: localizedName })}
              subtitle={t("realReviewsSubtitle")}
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
                // Route into the /locations/[slug]/[occasion] combo page
                // when one exists for this shoot type — gives the visitor
                // an editorial-rich landing for the (city × type) intent
                // instead of dropping them straight into search results.
                const COMBO_OCCASIONS = new Set([
                  "couples", "family", "proposal", "engagement",
                  "honeymoon", "solo", "elopement",
                ]);
                const href = COMBO_OCCASIONS.has(service.shootTypeSlug)
                  ? `/locations/${slug}/${service.shootTypeSlug}`
                  : `/photographers?location=${slug}&shoot=${service.shootTypeSlug}`;
                return (
                  <Link
                    key={service.shootTypeSlug}
                    href={href}
                    className="group relative overflow-hidden rounded-2xl bg-gray-900 shadow-lg transition hover:shadow-xl"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      {imgId ? (
                        <OptimizedImage
                          src={unsplashUrl(imgId, IMAGE_SIZES.cardLarge)}
                          alt={t("altShootInLocation", { type: localizeShootType(service.label, locale), location: localizedName })}
                          width={IMAGE_SIZES.cardLarge}
                          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-700" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="font-display text-xl font-bold text-white">
                        {localizeShootType(service.label, locale)} {t("photoshootIn")} {localizedName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-200 line-clamp-2">
                        {serviceDescription(service, locale)}
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
            <span className="text-sm font-semibold text-gray-700">{t("explore")}</span>
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
      {localizedFaqs.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("faqHeading", { location: localizedName })}
            </h2>
            <div className="mt-8 space-y-4">
              {localizedFaqs.map((faq, i) => (
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
            alt={t("altProfessionalShoot", { location: localizedName })}
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
