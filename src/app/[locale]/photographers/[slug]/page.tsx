import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { queryOne, query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveAbsoluteImageUrl } from "@/lib/image-url";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { adaptToPhotographerProfile } from "@/lib/photographer-adapter";
import { locations as allLocations } from "@/lib/locations-data";
import { PortfolioGallery } from "@/components/photographers/PortfolioGallery";
import { localizeShootType } from "@/lib/shoot-type-labels";
import { shootTypes as allShootTypes } from "@/lib/shoot-types-data";
import { localizeLanguageNames } from "@/lib/languages-i18n";
import { AskQuestionButton } from "@/components/ui/AskQuestionButton";
import { WishlistButton } from "@/components/ui/WishlistButton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ReviewsPaginated } from "@/components/ui/ReviewsPaginated";
import { ProfileTabs } from "@/components/ui/ProfileTabs";
import { PackageCard } from "@/components/ui/PackageCard";
import { localeAlternates } from "@/lib/seo";
import { normalizeName } from "@/lib/format-name";
import { ActiveBadge, ResponseTimeBadge } from "@/components/ui/ActiveBadge";
import { StickyBookBar } from "@/components/ui/StickyBookBar";
import { MobilePhotographerHero } from "@/components/photographers/MobilePhotographerHero";
import { flattenLocationNodes, getAncestorNodeSlugs, getLocationNode, type LocationNode } from "@/lib/location-hierarchy";
import { getPhotographerCoverageNodeSlugs } from "@/lib/photographer-location-coverage";
import { ExpandableChipList } from "@/components/ui/ExpandableChipList";

export const dynamicParams = true;
export const revalidate = 86400; // ISR: revalidate every 24 hours

type PublicLocation = (typeof allLocations)[number];

type CoverageGroup = {
  regionSlug: string;
  regionName: string;
  hrefSlug: string | null;
  wholeRegion: boolean;
  items: Array<{
    slug: string;
    name: string;
    hrefSlug: string | null;
  }>;
};

const publicLocationSlugs = new Set(allLocations.map((location) => location.slug));
const locationNodeSortIndex = new Map(flattenLocationNodes().map((node, index) => [node.slug, index]));

function publicHrefSlugForNode(node: LocationNode): string | null {
  return node.legacySlugs?.find((slug) => publicLocationSlugs.has(slug)) || null;
}

function coverageRegionForNode(node: LocationNode): LocationNode {
  const regionSlug = getAncestorNodeSlugs(node.slug)[0] || node.slug;
  return getLocationNode(regionSlug) || node;
}

function buildCoverageGroups(coverageNodeSlugs: string[], fallbackLocations: PublicLocation[]): CoverageGroup[] {
  const fallbackBySlug = new Map(fallbackLocations.map((location) => [location.slug, location]));
  const sourceSlugs = coverageNodeSlugs.length > 0 ? coverageNodeSlugs : fallbackLocations.map((location) => location.slug);
  const groups = new Map<string, CoverageGroup>();

  for (const slug of sourceSlugs) {
    const node = getLocationNode(slug);
    const fallback = fallbackBySlug.get(slug);
    if (!node && fallback) {
      groups.set(fallback.slug, {
        regionSlug: fallback.slug,
        regionName: fallback.name,
        hrefSlug: fallback.slug,
        wholeRegion: true,
        items: [],
      });
      continue;
    }
    if (!node) continue;

    const region = coverageRegionForNode(node);
    const group = groups.get(region.slug) || {
      regionSlug: region.slug,
      regionName: region.name,
      hrefSlug: publicHrefSlugForNode(region),
      wholeRegion: false,
      items: [],
    };

    if (node.slug === region.slug) {
      group.wholeRegion = true;
      group.items = [];
      group.hrefSlug = publicHrefSlugForNode(node) || group.hrefSlug;
    } else if (!group.wholeRegion && !group.items.some((item) => item.slug === node.slug)) {
      group.items.push({
        slug: node.slug,
        name: node.name,
        hrefSlug: publicHrefSlugForNode(node),
      });
    }

    groups.set(region.slug, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => (locationNodeSortIndex.get(a.slug) ?? 9999) - (locationNodeSortIndex.get(b.slug) ?? 9999)),
    }))
    .sort((a, b) => (locationNodeSortIndex.get(a.regionSlug) ?? 9999) - (locationNodeSortIndex.get(b.regionSlug) ?? 9999));
}

function compactRegionName(name: string): string {
  if (name === "Lisbon Region") return "Lisbon";
  if (name === "Porto & North") return "Porto";
  return name;
}

function formatMobileCoverageLabel(groups: CoverageGroup[]): string | null {
  if (groups.length === 0) return null;
  if (groups.length >= 3) return "Portugal-wide";
  return groups.map((group) => compactRegionName(group.regionName)).join(" · ");
}

async function getPhotographer(slug: string, canViewUnapproved = false, viewerUserId?: string, locale: string = "en") {
  const isAdmin = canViewUnapproved;
  // Locale-aware column resolution: COALESCE(p.bio_<loc>, p.bio) for non-EN locales
  const SUPPORTED = new Set(["pt", "de", "es", "fr"]);
  const useLoc = SUPPORTED.has(locale) ? locale : null;
  const tagCol = useLoc ? `COALESCE(p.tagline_${useLoc}, p.tagline)` : "p.tagline";
  const bioCol = useLoc ? `COALESCE(p.bio_${useLoc}, p.bio)` : "p.bio";
  const pkgNameCol = useLoc ? `COALESCE(name_${useLoc}, name)` : "name";
  const pkgDescCol = useLoc ? `COALESCE(description_${useLoc}, description)` : "description";
  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      bio: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      cover_position_y: number;
      languages: string[];
      shoot_types: string[];
      experience_years: number;
      is_verified: boolean;
      is_featured: boolean;
      is_founding: boolean;
      is_approved: boolean;
      plan: string;
      rating: number;
      review_count: number;
      session_count: number;
      last_seen_at: string | null;
      avg_response_minutes: number | null;
    }>(
      `SELECT p.id, p.slug, u.name, ${tagCol} as tagline, ${bioCol} as bio, u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              COALESCE(CASE WHEN p.career_start_year IS NOT NULL THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.career_start_year + 1 END, p.experience_years) as experience_years,
              p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding, p.is_approved, p.plan,
              p.rating, p.review_count, p.session_count, u.last_seen_at, p.avg_response_minutes
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1`,
      [slug]
    );
    if (!profile) return null;
    const isOwner = !!viewerUserId && await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE slug = $1 AND user_id = $2",
      [slug, viewerUserId]
    ).catch(() => null) !== null;
    if (!profile.is_approved && !isAdmin && !isOwner) return null;

    const locationRows = await query<{ location_slug: string }>(
      "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    );
    const locs = locationRows
      .map((r) => allLocations.find((l) => l.slug === r.location_slug))
      .filter((l): l is (typeof allLocations)[number] => l !== undefined);
    const legacyLocationSlugs = locs.map((location) => location.slug);
    const coverageNodeSlugs = await getPhotographerCoverageNodeSlugs(profile.id, legacyLocationSlugs)
      .catch(() => legacyLocationSlugs);

    const pkgs = await query<{
      id: string;
      name: string;
      description: string | null;
      duration_minutes: number;
      num_photos: number;
      price: number;
      is_popular: boolean;
      delivery_days: number;
      features: string[];
    }>(
      `SELECT id, ${pkgNameCol} as name, ${pkgDescCol} as description, duration_minutes, num_photos, price, is_popular, COALESCE(delivery_days, 7) as delivery_days, COALESCE(features, '{}') as features FROM packages WHERE photographer_id = $1 AND is_public = TRUE ORDER BY sort_order, price`,
      [profile.id]
    );

    const planLimits: Record<string, number> = { free: 100, pro: 100, premium: 100 };
    const photoLimit = planLimits[profile.plan] || 100;

    const portfolioItems = await query<{ url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null; width: number | null; height: number | null }>(
      "SELECT url, thumbnail_url, caption, location_slug, shoot_type, width, height FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at ASC LIMIT $2",
      [profile.id, photoLimit]
    );

    return {
      type: "db" as const,
      data: {
        ...profile,
        locations: locs,
        coverageNodeSlugs,
        packages: pkgs,
        portfolioItems,
      },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await getPhotographer(slug, false, undefined, locale);
  if (!result) return {};

  const t = await getTranslations({ locale, namespace: "photographers.profile" });

  const p = result.data;
  const allLocationNames = (p.locations || []).map((l: { name: string }) => l.name);
  const locationNames = allLocationNames.length <= 2
    ? allLocationNames.join(", ") || "Portugal"
    : `${allLocationNames.slice(0, 2).join(", ")} & ${allLocationNames.length - 2} more`;
  const title = t("metaTitle", { name: normalizeName(p.name), locations: locationNames });
  const topShootTypes = (p.shoot_types || []).slice(0, 2);
  const shootTypeText = topShootTypes.length > 0 ? ` Specializing in ${topShootTypes.join(" & ").toLowerCase()} photography.` : "";
  const ratingText = p.review_count > 0 ? ` ★ ${Number(p.rating).toFixed(1)} (${p.review_count} ${p.review_count === 1 ? "review" : "reviews"}).` : "";
  const description = `${t("metaDescription", { name: normalizeName(p.name), locations: locationNames || "Portugal" })}${shootTypeText}${ratingText} ${p.tagline || ""}`.trim();
  const rawImage = p.cover_url || p.avatar_url;
  const ogImage = resolveAbsoluteImageUrl(rawImage) || "https://photoportugal.com/og-image.png";
  const profileUrl = `https://photoportugal.com/photographers/${slug}`;

  // Pull a handful of public review photos to enrich social previews.
  let reviewPhotoUrls: string[] = [];
  if (result.type === "db") {
    try {
      const rps = await query<{ url: string }>(
        `SELECT rp.url FROM review_photos rp
         JOIN reviews r ON r.id = rp.review_id
         WHERE r.photographer_id = $1 AND r.is_approved = TRUE AND rp.is_public = TRUE
         ORDER BY r.created_at DESC LIMIT 4`,
        [p.id]
      );
      reviewPhotoUrls = rps.map((x) => {
        return resolveAbsoluteImageUrl(x.url) || `https://photoportugal.com${x.url}`;
      });
    } catch {}
  }

  const ogImages = [
    { url: ogImage, width: 1200, height: 630, alt: title },
    ...reviewPhotoUrls.map((url, i) => ({ url, width: 1200, height: 630, alt: `Client review photo ${i + 1} — ${normalizeName(p.name)}` })),
  ];
  return {
    title,
    description,
    alternates: localeAlternates(`/photographers/${slug}`, locale),
    openGraph: {
      title,
      description,
      type: "profile",
      url: profileUrl,
      images: ogImages,
      siteName: "Photo Portugal",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage, ...reviewPhotoUrls],
    },
    other: p.review_count > 0 ? {
      "og:rating": String(Number(p.rating).toFixed(1)),
      "og:rating_scale": "5",
      "og:rating_count": String(p.review_count),
    } : {},
  };
}

export default async function PhotographerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("photographers.profile");
  const tc = await getTranslations("common");

  // Locale-aware column names for reviews query below
  const REVIEW_LOCALES = new Set(["pt", "de", "es", "fr"]);
  const useLoc = REVIEW_LOCALES.has(locale) ? locale : null;

  const isPreview = !!process.env.ADMIN_PREVIEW_SECRET && sp.preview === process.env.ADMIN_PREVIEW_SECRET;
  const session = await auth();
  const viewerUserId = (session?.user as { id?: string } | undefined)?.id;
  const viewerIsPhotographer = (session?.user as { role?: string } | undefined)?.role === "photographer";
  const result = await getPhotographer(slug, isPreview, viewerUserId, locale);

  if (!result) {
    // Check slug_redirects for old slugs
    const slugRedirect = await queryOne<{ new_slug: string }>(
      `SELECT pp.slug as new_slug FROM slug_redirects sr
       JOIN photographer_profiles pp ON pp.id = sr.photographer_id
       WHERE sr.old_slug = $1`,
      [slug]
    ).catch(() => null);
    if (slugRedirect) {
      redirect(`/photographers/${slugRedirect.new_slug}`);
    }
    notFound();
  }

  const photographer = result.data;
  const coverageGroups = buildCoverageGroups(photographer.coverageNodeSlugs || [], photographer.locations || []);
  const coverageTitle = (() => {
    if (coverageGroups.length === 0) return "";
    if (coverageGroups.length === 1) {
      const group = coverageGroups[0];
      if (group.wholeRegion) return t("coverageWide", { region: group.regionName });
      return t("coverageRegion", { region: group.regionName });
    }
    if (coverageGroups.length === 2) {
      return t("coverageRegionsTwo", { first: coverageGroups[0].regionName, second: coverageGroups[1].regionName });
    }
    return t("coverageRegionsMany", { count: coverageGroups.length });
  })();
  const coverageChips = coverageGroups.length === 1 && !coverageGroups[0].wholeRegion
    ? [
        { key: coverageGroups[0].regionSlug, name: coverageGroups[0].regionName, hrefSlug: coverageGroups[0].hrefSlug },
        ...coverageGroups[0].items.map((item) => ({ key: item.slug, name: item.name, hrefSlug: item.hrefSlug })),
      ]
    : coverageGroups.map((group) => ({ key: group.regionSlug, name: group.regionName, hrefSlug: group.hrefSlug }));
  const coverageChipItems = coverageChips.map((chip) => ({
    key: chip.key,
    label: chip.name,
    href: chip.hrefSlug ? `/locations/${chip.hrefSlug}` : undefined,
  }));
  const hiddenCoverageChipCount = Math.max(0, coverageChipItems.length - 4);
  const compactCoverageCard = coverageGroups.length === 1 && coverageChipItems.length <= 2;
  const mobileCoverageLabel = formatMobileCoverageLabel(coverageGroups);
  const shootTypeChipItems = (photographer.shoot_types || []).map((type: string) => {
    const matched = allShootTypes.find((st) =>
      (st.photographerShootTypeNames || [st.name]).includes(type)
    );
    return {
      key: type,
      label: localizeShootType(type, locale),
      href: matched ? `/photoshoots/${matched.slug}` : undefined,
    };
  });
  const hiddenShootTypeChipCount = Math.max(0, shootTypeChipItems.length - 5);
  const hasExperience = photographer.experience_years > 0;
  const hasLanguages = photographer.languages && photographer.languages.length > 0 && photographer.languages[0] !== "";
  let reviews: { id: string; rating: number; title: string | null; text: string | null; is_verified: boolean; created_at: string; client_name: string | null; client_avatar: string | null; photos?: { id: string; url: string }[]; package_name?: string | null; package_id?: string | null; client_country?: string | null }[] = [];
  const portfolioItems = (photographer as { portfolioItems?: { url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null }[] }).portfolioItems || [];

  // Fetch real reviews from DB for DB photographers
  if (result.type === "db") {
    try {
      const dbReviews = await query<{
        id: string;
        rating: number;
        title: string | null;
        text: string | null;
        title_original: string | null;
        text_original: string | null;
        source_locale: string | null;
        is_verified: boolean;
        created_at: string;
        client_name: string | null;
        client_avatar: string | null;
        photos: { id: string; url: string }[];
        video_url: string | null;
        package_id: string | null;
        package_name: string | null;
        client_country: string | null;
      }>(
        `SELECT r.id, r.rating,
                ${useLoc ? `COALESCE(r.title_${useLoc}, r.title)` : "r.title"} as title,
                ${useLoc ? `COALESCE(r.text_${useLoc}, r.text)` : "r.text"} as text,
                r.title as title_original, r.text as text_original, r.source_locale,
                r.is_verified, r.created_at, r.video_url,
                COALESCE(r.client_name_override, u.name) as client_name,
                u.avatar_url as client_avatar,
                b.package_id,
                pkg.name as package_name,
                COALESCE(r.client_country_override,
                  (SELECT vs.country FROM visitor_sessions vs
                   WHERE vs.user_id = r.client_id AND vs.country IS NOT NULL
                   ORDER BY vs.started_at ASC LIMIT 1)) as client_country,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', rp.id, 'url', rp.url) ORDER BY rp.created_at)
                   FROM review_photos rp WHERE rp.review_id = r.id AND rp.is_public = true),
                  '[]'::json
                ) as photos
         FROM reviews r
         LEFT JOIN users u ON u.id = r.client_id
         LEFT JOIN bookings b ON b.id = r.booking_id
         LEFT JOIN packages pkg ON pkg.id = b.package_id
         WHERE r.photographer_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC`,
        [photographer.id]
      );
      reviews = dbReviews.map((r) => ({
        id: r.id,
        booking_id: "",
        client_id: "",
        photographer_id: photographer.id,
        client_name: r.client_name,
        client_avatar: r.client_avatar,
        rating: r.rating,
        title: r.title || "",
        text: r.text || "",
        photos: (r.photos as { id: string; url: string }[]) || [],
        photos_public: true,
        video_url: r.video_url || null,
        is_verified: r.is_verified,
        created_at: r.created_at,
        package_id: r.package_id,
        package_name: r.package_name,
        client_country: r.client_country,
      }));
    } catch {}
  }

  // Fetch similar photographers who serve the same locations. Pull the full
  // PhotographerCard field set so this section uses the same rich card as
  // /photographers — no more bespoke mini-card here.
  type SimilarRow = {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; cover_position_y: number | null;
    portfolio_thumbs: string[] | null;
    is_featured: boolean; is_verified: boolean; is_founding: boolean;
    tagline: string | null; rating: number; review_count: number;
    starting_price: string | null;
    locations: string | null;
    last_active_at: string | null; avg_response_minutes: number | null;
  };
  let similarPhotographers: SimilarRow[] = [];
  const primaryLocation = photographer.locations?.[0];
  if (result.type === "db") {
    try {
      similarPhotographers = await query<SimilarRow>(
        `SELECT DISTINCT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.cover_position_y,
                pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
                pp.tagline, pp.rating, pp.review_count,
                u.last_seen_at as last_active_at, pp.avg_response_minutes,
                (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as starting_price,
                (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
                 FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
                ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 7) as portfolio_thumbs
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.is_approved = TRUE
         AND pp.id != $1
         AND pp.id IN (
           SELECT photographer_id FROM photographer_locations
           WHERE location_slug IN (SELECT location_slug FROM photographer_locations WHERE photographer_id = $1)
         )
         ORDER BY pp.is_featured DESC, pp.is_verified DESC, pp.rating DESC, pp.review_count DESC
         LIMIT 3`,
        [photographer.id]
      );
    } catch {}
  }

  const profileUrl = `https://photoportugal.com/photographers/${slug}`;
  const toAbsoluteUrl = (src: string) =>
    src.startsWith("http") ? src : `https://photoportugal.com${src}`;
  const reviewPhotoAbsolute = reviews
    .flatMap((r) => (r.photos || []).map((p: { url: string }) => p.url))
    .map(toAbsoluteUrl);
  const schemaImages = [
    ...([photographer.cover_url, photographer.avatar_url].filter(Boolean) as string[]).map(toAbsoluteUrl),
    ...reviewPhotoAbsolute,
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": profileUrl,
    name: normalizeName(photographer.name),
    description: photographer.bio || photographer.tagline,
    url: profileUrl,
    image: schemaImages.length > 0 ? schemaImages : undefined,
    ...(primaryLocation?.lat && primaryLocation?.lng
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: primaryLocation.lat,
            longitude: primaryLocation.lng,
          },
        }
      : {}),
    priceRange: photographer.packages?.length > 0 ? `From €${Math.round(Math.min(...photographer.packages.map((pkg: { price: number }) => Number(pkg.price))))}` : undefined,
    aggregateRating: photographer.review_count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: photographer.rating,
          reviewCount: photographer.review_count,
          bestRating: 5,
        }
      : undefined,
    // Reviews nested directly inside the LocalBusiness they describe.
    // We deliberately DON'T include `itemReviewed` on each Review here:
    // Google flags it as a directional conflict because the parent
    // already implies what's being reviewed. Adding it on a nested Review
    // triggers "Invalid object type for field <parent_node>" in
    // Search Console (saw this on photoportugal.com 2026-04-30).
    ...(reviews.length > 0
      ? {
          review: reviews.map((r) => {
            const body = r.text || r.title;
            const photoUrls = (r.photos || []).map((p: { url: string }) => toAbsoluteUrl(p.url));
            return {
              "@type": "Review",
              ...(r.client_name ? { author: { "@type": "Person", name: r.client_name } } : {}),
              reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
              ...(body ? { reviewBody: body } : {}),
              ...(r.title ? { name: r.title } : {}),
              datePublished: new Date(r.created_at).toISOString().split("T")[0],
              ...(photoUrls.length > 0 ? {
                image: photoUrls,
                associatedMedia: photoUrls.map((url: string) => ({ "@type": "ImageObject", contentUrl: url, url })),
              } : {}),
            };
          }),
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: photographer.locations?.[0]?.name,
      addressRegion: photographer.locations?.[0]?.name,
      addressCountry: "PT",
    },
    areaServed: (photographer.locations || []).map((l: { name: string }) => ({
      "@type": "City",
      name: l.name,
    })),
  };

  // We used to emit one Product schema per package here, but Search
  // Console flagged each with "Missing field 'review' / 'aggregateRating'"
  // — Google wants Products to carry per-product reviews, and ours live
  // at the photographer (LocalBusiness) level, not per package. Pricing
  // still surfaces via LocalBusiness.priceRange + nested Offers, and the
  // Person schema below carries `makesOffer` for the catalog. Cleaner
  // and Search Console–quiet.

  const avatarAbsoluteUrl = photographer.avatar_url
    ? (photographer.avatar_url.startsWith("http") ? photographer.avatar_url : `https://photoportugal.com${photographer.avatar_url}`)
    : undefined;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: normalizeName(photographer.name),
    ...(avatarAbsoluteUrl && { image: avatarAbsoluteUrl }),
    jobTitle: "Photographer",
    url: `https://photoportugal.com/photographers/${slug}`,
    ...(photographer.locations && photographer.locations.length > 0 && {
      workLocation: photographer.locations.map((l: { name: string }) => ({
        "@type": "City",
        name: l.name,
        addressCountry: "PT",
      })),
    }),
    ...(photographer.languages && photographer.languages.length > 0 && photographer.languages[0] !== "" && {
      knowsLanguage: photographer.languages,
    }),
    ...(photographer.review_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: photographer.rating,
        reviewCount: photographer.review_count,
        bestRating: 5,
      },
    }),
    ...(photographer.packages && photographer.packages.length > 0 && {
      makesOffer: photographer.packages.map((pkg: { name: string; price: number; description: string | null; duration_minutes: number; num_photos: number }) => ({
        "@type": "Offer",
        name: pkg.name,
        priceCurrency: "EUR",
        price: String(pkg.price),
        description: pkg.description || `${pkg.duration_minutes} min session, ${pkg.num_photos} photos`,
      })),
    }),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("home"), item: "https://photoportugal.com" },
      { "@type": "ListItem", position: 2, name: tc("photographers"), item: "https://photoportugal.com/photographers" },
      { "@type": "ListItem", position: 3, name: normalizeName(photographer.name), item: `https://photoportugal.com/photographers/${slug}` },
    ],
  };

  const showPreviewBanner = result.type === "db" && !(photographer as { is_approved?: boolean }).is_approved;

  return (
    <>
      {showPreviewBanner && (
        <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{t("previewBannerTitle")}.</span>{" "}
              {t("previewBannerText")}
            </p>
          </div>
        </div>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* Mobile-only conversion-first hero: full-width swipeable cover
          carousel with name + rating overlay. Replaces the wall-of-text
          mobile hero (avatar/tags/notices) so above-the-fold is dominated
          by the photographer's actual work. Built for paid-ad LP traffic
          where price+visual discovery beat verbose intros. */}
      {(() => {
        const thumbs: string[] = [];
        if (photographer.cover_url) thumbs.push(photographer.cover_url);
        for (const item of portfolioItems) {
          if (item.url && !thumbs.includes(item.url)) thumbs.push(item.url);
          if (thumbs.length >= 8) break;
        }
        return (
          <MobilePhotographerHero
            slug={slug}
            name={photographer.name}
            isVerified={!!photographer.is_verified}
            isFeatured={!!photographer.is_featured}
            isFounding={!!photographer.is_founding}
            rating={photographer.rating}
            reviewCount={photographer.review_count}
            lastSeenAt={photographer.last_seen_at ?? null}
            responseLabel={null}
            primaryLocationName={mobileCoverageLabel}
            thumbnails={thumbs}
            coverPositionY={photographer.cover_position_y ?? null}
          />
        );
      })()}

      {/* Desktop hero — original avatar+text layout. Hidden on mobile via
          `hidden lg:block` since MobilePhotographerHero owns that surface. */}
      <div className="hidden lg:block bg-warm-50 pt-6 pb-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full ring-4 ring-white bg-primary-100 text-3xl font-bold text-primary-600 overflow-hidden shadow-md">
                {photographer.avatar_url ? (
                  <OptimizedImage src={photographer.avatar_url} alt={normalizeName(photographer.name)} width={400} priority className="h-full w-full" />
                ) : (
                  normalizeName(photographer.name).charAt(0)
                )}
              </div>
              <div className="mt-2 flex justify-center">
                <ActiveBadge lastSeenAt={photographer.last_seen_at} size="sm" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
                  {normalizeName(photographer.name)}
                </h1>
                {photographer.is_verified && (
                  <span className="text-accent-500" title={t("verifiedPhotographer")}>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                {photographer.is_featured && (
                  <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-700">{tc("featured")}</span>
                )}
                {photographer.is_founding && (
                  <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">{tc("foundingPhotographer")}</span>
                )}
              </div>

              {photographer.tagline && (
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500">{photographer.tagline}</p>
              )}

              {photographer.review_count > 0 && (
                <a href="#reviews" className="mt-1.5 inline-flex items-center gap-1 text-sm transition hover:text-primary-600">
                  <span className="flex items-center gap-0.5 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className={`h-3.5 w-3.5 ${i < Math.round(photographer.rating) ? "fill-current" : "fill-current opacity-20"}`} viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                  <span className="font-semibold text-gray-900">{Number(photographer.rating).toFixed(1)}</span>
                  <span className="text-gray-400">({photographer.review_count} {photographer.review_count !== 1 ? tc("reviews") : tc("review")})</span>
                </a>
              )}

              {coverageGroups.length > 0 && (
                <div className={`mt-2 max-w-full rounded-xl border border-warm-200 bg-white/75 px-3 py-2 shadow-sm ${compactCoverageCard ? "inline-flex w-fit" : "block max-w-3xl"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /></svg>
                      </span>
                      <span>{coverageTitle}</span>
                    </div>
                    <ExpandableChipList
                      items={coverageChipItems}
                      visibleCount={4}
                      moreLabel={t("coverageMore", { count: hiddenCoverageChipCount })}
                      className={compactCoverageCard ? "min-w-0" : "min-w-0 flex-1"}
                      chipClassName="border-warm-200 bg-warm-50 text-gray-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                      moreClassName="border-warm-200 bg-white text-gray-500 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                    />
                  </div>
                </div>
              )}

              {(hasExperience || hasLanguages) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                  {hasExperience && (
                    <span>{tc("yrsExperience", { years: photographer.experience_years })}</span>
                  )}
                  {hasExperience && hasLanguages && <span className="text-gray-300">·</span>}
                  {hasLanguages && (
                    <span>{localizeLanguageNames(photographer.languages, locale).join(", ")}</span>
                  )}
                </div>
              )}

              {shootTypeChipItems.length > 0 && (
                <div className="mt-2 border-t border-warm-200 pt-2">
                  <ExpandableChipList
                    items={shootTypeChipItems}
                    visibleCount={5}
                    moreLabel={t("coverageMore", { count: hiddenShootTypeChipCount })}
                    chipClassName="border-primary-200 bg-white/60 text-primary-600 hover:bg-primary-50"
                    moreClassName="border-primary-200 bg-white text-primary-600 hover:bg-primary-50"
                  />
                </div>
              )}
            </div>

            {result.type === "db" && !viewerIsPhotographer && (
              <div id="message" className="flex shrink-0 flex-col items-end gap-1.5 sm:ml-auto sm:self-center">
                <div className="flex items-center gap-3">
                  <WishlistButton photographerId={photographer.id} size="md" className="border border-warm-200 shadow-sm" />
                  <AskQuestionButton photographerId={photographer.id} photographerName={normalizeName(photographer.name)} autoOpen={typeof window !== "undefined" && window.location.hash === "#message"} />
                </div>
                <ResponseTimeBadge avgMinutes={photographer.avg_response_minutes} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Seasonal urgency — April to September. Hidden on mobile because
            it competes with the visual hero for attention; desktop still
            shows it inline above the main grid. */}
        {(() => {
          const month = new Date().getMonth();
          return month >= 3 && month <= 8 ? (
            <p className="mt-4 hidden lg:flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {tc("summerSeasonNotice")}
            </p>
          ) : null;
        })()}

        <div className="mt-8 grid grid-cols-1 gap-6 pb-16 sm:gap-8 lg:grid-cols-3 lg:gap-12">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-12">
            {/* About / Reviews tabs — above portfolio */}
            <ProfileTabs
              aboutLabel={t("about")}
              reviewsLabel={tc("reviewsTitle")}
              reviewCount={photographer.review_count}
              about={
                photographer.bio ? (
                  <section>
                    <p className="max-w-3xl text-gray-600 leading-relaxed">{photographer.bio}</p>
                  </section>
                ) : null
              }
              reviews={
                <ReviewsPaginated
                  reviews={reviews}
                  reviewCount={photographer.review_count}
                  rating={photographer.rating}
                  photographerName={normalizeName(photographer.name)}
                  photographerSlug={slug}
                />
              }
            />

            {/* Portfolio — always visible below tabs */}
            {portfolioItems.length > 0 && (
              <PortfolioGallery
                items={portfolioItems}
                locations={allLocations.map((l) => ({ slug: l.slug, name: l.name }))}
                photographerName={normalizeName(photographer.name)}
              />
            )}
          </div>

          {/* Packages — sidebar on desktop (sticky vertical stack), but on
              mobile they jump to the top of the page (`order-first`) and
              render as a horizontal snap-carousel right below the hero so
              price discovery happens before the visitor scrolls anywhere.
              Each package card snaps to centre with a peek of the next. */}
          <div id="packages" className="lg:col-span-1 order-first lg:order-none">
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:space-y-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
              {photographer.packages && photographer.packages.length > 0 && (
                <>
                  <h2 className="px-4 pt-6 text-xl font-bold text-gray-900 lg:px-0 lg:pt-0">{t("packages")}</h2>
                  {/* Mobile: horizontal scroll-snap. Desktop: vertical stack. */}
                  <div className="-mx-4 sm:-mx-6 lg:-mx-0 flex gap-3 overflow-x-auto snap-x snap-mandatory overscroll-x-contain px-4 sm:px-6 pt-3 pb-2 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:px-0 lg:py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {photographer.packages.map((pkg: { id: string; name: string; description: string | null; price: number; duration_minutes: number; num_photos: number; is_popular: boolean; delivery_days?: number }) => (
                      <div key={pkg.id} className="snap-center shrink-0 w-[78vw] max-w-[340px] lg:w-auto lg:max-w-none">
                        <PackageCard pkg={pkg} photographerSlug={photographer.slug} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Contact card for profiles without packages */}
              {(!photographer.packages || photographer.packages.length === 0) && (
                <div className="mx-4 mt-6 rounded-xl border border-warm-200 bg-white p-6 sm:mx-6 lg:mx-0 lg:mt-0">
                  <h2 className="text-lg font-bold text-gray-900">{t("interested")}</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {t("sendMessagePricing")}
                  </p>
                </div>
              )}

              {/* Message button moved to hero */}
            </div>
          </div>
        </div>
      </div>

      {/* More Photographers in Location */}
      {similarPhotographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              {primaryLocation
                ? t("moreInLocation", { location: primaryLocation.name })
                : t("similarPhotographers")}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similarPhotographers.map((sp) => (
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
          </div>
        </section>
      )}
      {/* Sticky book bar — mobile only */}
      {result.type === "db" && (
        <StickyBookBar
          minPrice={photographer.packages?.length > 0 ? Math.min(...photographer.packages.map((pkg: { price: number }) => Number(pkg.price))) : null}
          photographerName={normalizeName(photographer.name)}
        />
      )}
    </>
  );
}
