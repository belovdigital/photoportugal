import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes, getShootTypeBySlug, shootTypeLocalized } from "@/lib/shoot-types-data";
import { ReviewsStrip } from "@/components/ui/ReviewsStrip";
import { getReviewsForShootType } from "@/lib/reviews-data";
import { locations } from "@/lib/locations-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { localeAlternates } from "@/lib/seo";
import { queryOne, query } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { normalizeName } from "@/lib/format-name";
import { PhotographerCardCompact } from "@/components/ui/PhotographerCardCompact";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { HeroSingleVariant, type HeroFeaturedPhotographer, type HeroLocationContext } from "@/components/ui/HeroSingleVariant";
import { PortfolioMosaic } from "@/components/ui/PortfolioMosaic";
import { LocationPhotosMasonry, type LocationMasonryPhoto } from "@/components/ui/LocationPhotosMasonry";
import { formatDuration } from "@/lib/package-pricing";

// Force-dynamic so the hero photographer reshuffles on every request.
// Same rationale as the location page: paid-ad / sitelink landing prefers
// freshness over static SEO weight.
export const dynamic = "force-dynamic";

// Combo /locations/[slug]/[occasion] exists for this subset of shoot types,
// so the Best Locations grid below routes there when applicable. Anything
// else still falls through to /locations/<slug>.
const COMBO_OCCASIONS = new Set([
  "couples", "family", "proposal", "engagement",
  "honeymoon", "solo", "elopement",
]);

// Per-locale "in" preposition ("Portugal Photographer in Portugal" reads
// fine in EN; other languages need the localized connector). Same scheme
// as the combo page.
const IN_PREP: Record<string, string> = {
  en: "in", pt: "em", de: "in", es: "en", fr: "à",
};

// Localized "Portugal" — same in all 5 locales right now, but keeping the
// map in case we ever want "Portugal" / "Portugalia" / etc.
const PORTUGAL_LABEL: Record<string, string> = {
  en: "Portugal", pt: "Portugal", de: "Portugal", es: "Portugal", fr: "Portugal",
};

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
  const tLoc = await getTranslations("locations.detail");

  const shootType = getShootTypeBySlug(type);
  if (!shootType) notFound();

  const stl = shootTypeLocalized(shootType, locale);
  // Names that the DB stores in photographer_profiles.shoot_types[] AND
  // portfolio_items.shoot_type — usually [shootType.name], but some types
  // have multiple aliases (slug "solo" → ["Solo Travel", "Solo Portrait"])
  // because photographers tagged their work either way. Use the full alias
  // array everywhere so all rows surface, not just first-alias matches.
  const dbShootTypeNames = shootType.photographerShootTypeNames || [shootType.name];

  const portugalLabel = PORTUGAL_LABEL[locale] || "Portugal";
  const inPrep = IN_PREP[locale] || "in";

  // ─── Aggregate stats Portugal-wide for this shoot type ────────────────
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
               JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
               WHERE pp2.is_approved = TRUE AND pk.is_public = TRUE
                 AND pp2.shoot_types && $1::text[]) as min_price,
              (SELECT MIN(pk.duration_minutes) FROM packages pk
               JOIN photographer_profiles pp3 ON pp3.id = pk.photographer_id
               WHERE pp3.is_approved = TRUE AND pk.is_public = TRUE
                 AND pk.duration_minutes IS NOT NULL
                 AND pp3.shoot_types && $1::text[]) as min_duration,
              (SELECT MAX(pk.duration_minutes) FROM packages pk
               JOIN photographer_profiles pp4 ON pp4.id = pk.photographer_id
               WHERE pp4.is_approved = TRUE AND pk.is_public = TRUE
                 AND pk.duration_minutes IS NOT NULL
                 AND pp4.shoot_types && $1::text[]) as max_duration
       FROM photographer_profiles pp
       WHERE pp.is_approved = TRUE
         AND pp.shoot_types && $1::text[]`,
      [dbShootTypeNames]
    );
    photographerCount = parseInt(row?.count || "0");
    avgRating = row?.avg_rating ? parseFloat(parseFloat(row.avg_rating).toFixed(1)) : 0;
    totalReviews = parseInt(row?.total_reviews || "0");
    minPrice = row?.min_price ? parseFloat(row.min_price) : null;
    minDuration = row?.min_duration ? parseInt(row.min_duration) : null;
    maxDuration = row?.max_duration ? parseInt(row.max_duration) : null;
  } catch {}

  const fmt = (min: number) => formatDuration(min, locale);
  const durationText = minDuration && maxDuration
    ? (minDuration === maxDuration ? fmt(minDuration) : `${fmt(minDuration)} – ${fmt(maxDuration)}`)
    : null;

  // ─── Hero photographer (Portugal-wide, filtered to this shoot type) ───
  // Same weighted-random pattern as the location page; portfolio carousel
  // photos are filtered by this shoot type so the hero rotates through
  // matching work, not random portfolio pieces.
  let heroPhotographer: HeroFeaturedPhotographer | null = null;
  try {
    const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
    const useLoc = TR_LOCALES.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    const heroRows = await query<{
      slug: string; name: string; tagline: string | null;
      cover_url: string | null; avatar_url: string | null;
      rating: string; review_count: number; session_count: number;
      portfolio_urls: string[] | null;
    }>(
      `SELECT pp.slug, u.name, ${taglineSql} as tagline, pp.cover_url, u.avatar_url,
              COALESCE(pp.rating, 0)::text as rating,
              COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pp.session_count, 0) as session_count,
              -- HERO carousel: include ALL of this photographer's photos
              -- so the 12-frame rotation never goes thin (e.g. honeymoon
              -- has only 6 tagged photos site-wide). Match first, untagged
              -- second, other shoot types last — relevant work surfaces
              -- first but the rotation always fills.
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                ORDER BY
                  CASE
                    WHEN pi.shoot_type = ANY($1::text[]) THEN 0
                    WHEN pi.shoot_type IS NULL THEN 1
                    ELSE 2
                  END,
                  pi.sort_order NULLS LAST, pi.created_at
                LIMIT 12
              ) as portfolio_urls
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND pp.shoot_types && $1::text[]
         AND EXISTS (
           SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
         )
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 1`,
      [dbShootTypeNames]
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
        location_name: portugalLabel,
        location_slug: "",
        portfolio_urls: (r.portfolio_urls || []).filter(Boolean),
      };
    }
  } catch {}

  // ─── Portfolio pool: photos tagged with this shoot type, Portugal-wide ─
  type ShootTypePortfolioRow = {
    url: string; width: number | null; height: number | null;
    slug: string; name: string; avatar_url: string | null;
    location_slug: string | null;
  };
  let mosaicPhotos: { url: string; slug: string; name: string; location: string | null }[] = [];
  let masonryPhotos: LocationMasonryPhoto[] = [];
  try {
    const rows = await query<ShootTypePortfolioRow>(
      `SELECT pi.url, pi.width, pi.height, pp.slug, u.name, u.avatar_url, pi.location_slug
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       JOIN users u ON u.id = pp.user_id
       WHERE pi.type = 'photo'
         AND pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND (pi.shoot_type = ANY($1::text[]) OR pi.shoot_type IS NULL)
       ORDER BY
         CASE WHEN pi.shoot_type = ANY($1::text[]) THEN 0 ELSE 1 END,
         -LN(RANDOM()) / (CASE
           WHEN pp.is_featured THEN 50
           WHEN pp.is_verified THEN 30
           WHEN COALESCE(pp.is_founding, FALSE) THEN 15
           WHEN pp.early_bird_tier IS NOT NULL THEN 5
           ELSE 2
         END) ASC
       LIMIT 60`,
      [dbShootTypeNames]
    );
    mosaicPhotos = rows.slice(0, 24).map((r) => {
      const locName = r.location_slug
        ? (locations.find((l) => l.slug === r.location_slug)?.name || null)
        : null;
      return { url: r.url, slug: r.slug, name: r.name, location: locName };
    });
    masonryPhotos = rows.slice(0, 30).map((r) => ({
      url: r.url, width: r.width, height: r.height,
      photographer: { slug: r.slug, name: r.name, avatar_url: r.avatar_url },
    }));
  } catch {}

  // Total photographer count for the hero "browse all N" link.
  let totalPhotographers = 0;
  try {
    const totalRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM photographer_profiles
       WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
    );
    totalPhotographers = totalRow?.count ?? 0;
  } catch {}

  const heroLocationContext: HeroLocationContext = {
    slug: "",
    name: portugalLabel,
    region: tc("photoshoots"),
    photographerCount,
    minPrice,
    durationText,
    avgRating: avgRating || null,
    totalReviews,
    occasionLabel: stl.name,
    occasionPreposition: inPrep,
  };

  // ─── Top photographers (filtered, with full inline-package data) ──────
  type ShootTypePhotographerRow = {
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
  let topPhotographers: ShootTypePhotographerRow[] = [];
  try {
    const TR_LOCALES = new Set(["pt", "de", "es", "fr"]);
    const useLoc = TR_LOCALES.has(locale) ? locale : null;
    const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
    topPhotographers = await query<ShootTypePhotographerRow>(
      `SELECT pp.id, pp.slug, u.name, u.avatar_url,
              pp.cover_url, pp.cover_position_y,
              pp.is_featured, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
              ${taglineSql} as tagline, pp.rating, pp.review_count,
              u.last_seen_at as last_active_at, pp.avg_response_minutes,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::text as starting_price,
              (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id LIMIT 3) as locations,
              ARRAY(
                SELECT pi.url FROM portfolio_items pi
                WHERE pi.photographer_id = pp.id AND pi.type = 'photo'
                  AND (pi.shoot_type = ANY($1::text[]) OR pi.shoot_type IS NULL)
                ORDER BY
                  CASE WHEN pi.shoot_type = ANY($1::text[]) THEN 0 ELSE 1 END,
                  pi.sort_order NULLS LAST, pi.created_at
                LIMIT 7
              ) as portfolio_thumbs,
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
              (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)::int as packages_count
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE
         AND pp.shoot_types && $1::text[]
       ORDER BY pp.is_featured DESC, pp.is_verified DESC, RANDOM()
       LIMIT 6`,
      [dbShootTypeNames]
    );
  } catch {}

  // Reviews from photographers offering this shoot type.
  const shootTypeReviews = await getReviewsForShootType(dbShootTypeNames, 6, locale);

  // Real packages from photographers offering this shoot type — featured
  // below the photographer grid as a "book directly" shortcut.
  const packages = await query<{
    id: string; name: string; price: number; duration_minutes: number; num_photos: number;
    photographer_slug: string; photographer_name: string; photographer_avatar: string | null;
    rating: number; review_count: number;
  }>(
    `SELECT pk.id, pk.name, pk.price, pk.duration_minutes, pk.num_photos,
            pp.slug as photographer_slug, u.name as photographer_name, u.avatar_url as photographer_avatar,
            pp.rating, pp.review_count
     FROM packages pk
     JOIN photographer_profiles pp ON pp.id = pk.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE pp.is_approved = TRUE AND pk.is_public = TRUE
       AND pp.shoot_types && $1::text[]
     ORDER BY pp.review_count DESC NULLS LAST, pk.price ASC
     LIMIT 6`,
    [dbShootTypeNames]
  ).catch(() => []);

  // Related blog posts (locale-aware).
  const relatedPosts = await query<{
    slug: string; title: string; excerpt: string | null; cover_image_url: string | null;
  }>(
    `SELECT slug, title, excerpt, cover_image_url FROM blog_posts
     WHERE is_published = TRUE AND COALESCE(locale, 'en') = $3 AND (
       LOWER(title) LIKE $1 OR LOWER(content) LIKE $1 OR LOWER(title) LIKE $2 OR LOWER(content) LIKE $2
     ) ORDER BY published_at DESC LIMIT 4`,
    [`%${shootType.slug}%`, `%${shootType.name.toLowerCase()}%`, locale]
  ).catch(() => []);

  // ─── Schema.org JSON-LD ───────────────────────────────────────────────
  const jsonLdService = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: shootType.name,
    name: stl.title,
    description: stl.metaDescription,
    url: `https://photoportugal.com/photoshoots/${type}`,
    provider: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
    areaServed: { "@type": "Country", name: "Portugal" },
    ...(minPrice ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        price: String(minPrice),
        availability: "https://schema.org/InStock",
        url: `https://photoportugal.com/photographers?shootType=${type}`,
      },
    } : {}),
    ...(totalReviews > 0 && avgRating > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating,
        reviewCount: totalReviews,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };

  const jsonLdFaq = stl.faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: stl.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("home"), item: "https://photoportugal.com/" },
      { "@type": "ListItem", position: 2, name: tc("photoshoots"), item: "https://photoportugal.com/photoshoots" },
      { "@type": "ListItem", position: 3, name: stl.name, item: `https://photoportugal.com/photoshoots/${type}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdService) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("photoshoots"), href: "/photoshoots" },
          { name: stl.name, href: `/photoshoots/${type}` },
        ]}
      />

      {/* Hero — same single-photographer carousel as the location pages,
          but with synthetic Portugal context + occasionLabel so the h1
          reads "<ShootType> Photographer in Portugal" with the chip row
          below showing Portugal-wide stats. */}
      {heroPhotographer ? (
        <HeroSingleVariant
          photographer={heroPhotographer}
          locationContext={heroLocationContext}
          totalPhotographers={totalPhotographers}
        />
      ) : (
        // Fallback if no photographer matches yet — keep the page whole.
        <section className="bg-warm-50">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">{stl.h1}</h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">{stl.heroText}</p>
            <div className="mt-8 max-w-xl">
              <MatchQuickForm
                presetShootType={shootType.slug}
                source={`photoshoot_${shootType.slug}`}
                size="md"
              />
            </div>
          </div>
        </section>
      )}

      {/* Editorial intro (heroText) — under the hero so the page reads
          immediately as "this is for {ShootType} in Portugal". */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
            {stl.h1}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed text-base sm:text-lg">{stl.heroText}</p>
          {photographerCount > 0 && (
            <p className="mt-3 text-sm text-gray-500">
              {(() => {
                const label = ({
                  en: `${photographerCount} ${photographerCount === 1 ? "photographer" : "photographers"} ready in Portugal`,
                  pt: `${photographerCount} ${photographerCount === 1 ? "fotógrafo pronto" : "fotógrafos prontos"} em Portugal`,
                  de: `${photographerCount} ${photographerCount === 1 ? "Fotograf bereit" : "Fotografen bereit"} in Portugal`,
                  es: `${photographerCount} ${photographerCount === 1 ? "fotógrafo listo" : "fotógrafos listos"} en Portugal`,
                  fr: `${photographerCount} ${photographerCount === 1 ? "photographe prêt" : "photographes prêts"} au Portugal`,
                } as Record<string, string>)[locale];
                return label || `${photographerCount} photographers ready in Portugal`;
              })()}
            </p>
          )}
        </div>
      </section>

      {/* About the shoot type + Best Locations sticky panel.
          Left: editorial copy on why Portugal for this shoot, plus pills
          linking to the COMBO pages (this is the cross-pollination point —
          /photoshoots/couples here links into /locations/{city}/couples).
          Right: portfolio mosaic with photos tagged for this shoot type. */}
      <section className="relative bg-warm-50">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
            <div className="max-w-xl lg:sticky lg:top-24">
              <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                {t("bestLocationsTitle", { name: stl.name })}
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                {t("bestLocationsSubtitle", { name: stl.name.toLowerCase() })}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {shootType.bestLocations.slice(0, 8).map((loc) => {
                  const locR = loc as unknown as Record<string, string | undefined>;
                  const locName = locR[`name_${locale}`] || loc.name;
                  const href = COMBO_OCCASIONS.has(shootType.slug)
                    ? `/locations/${loc.slug}/${shootType.slug}`
                    : `/locations/${loc.slug}`;
                  return (
                    <Link
                      key={loc.slug}
                      href={href}
                      className="rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-100 hover:text-primary-800"
                    >
                      {locName}
                    </Link>
                  );
                })}
              </div>

              <Link
                href={`/photographers?shootType=${shootType.slug}`}
                className="mt-8 inline-flex rounded-xl bg-primary-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
              >
                {t("findPhotographers", { name: stl.name })}
              </Link>
            </div>

            <div className="hidden lg:block lg:h-[140vh]">
              {mosaicPhotos.length > 0 && (
                <PortfolioMosaic photos={mosaicPhotos.slice(0, 24)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Real photos masonry — tagged with this shoot type, Portugal-wide */}
      {masonryPhotos.length > 0 && (
        <LocationPhotosMasonry photos={masonryPhotos} />
      )}

      {/* Photographer grid — filtered by shoot type, with inline package
          CTAs (PhotographerCardCompact, replaces the older simpler card). */}
      {topPhotographers.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("bestPhotographers", { name: stl.name })}
            </h2>
            <p className="mt-2 text-gray-500">
              {t("photographersSubtitle", { name: stl.name.toLowerCase() })}
            </p>
            <div className="mt-6">
              <ScarcityBanner count={photographerCount} locationName={stl.name} locale={locale} context="shootType" />
            </div>
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
                  href={`/photographers?shootType=${shootType.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
                >
                  {t("viewAllPhotographers", { name: stl.name })}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reviews from photographers offering this shoot type */}
      {shootTypeReviews.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
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

      {/* How It Works — shared component (matches location page) */}
      <HowItWorksSection />

      {/* Best Locations as full cards with reasons. Each links into the
          /locations/{slug}/{type} combo page when one exists, otherwise
          the parent location page. This is the SEO + conversion bridge
          between the global shoot-type page and the city-level combos. */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {t("bestLocationsTitle", { name: stl.name })}
          </h2>
          <p className="mt-2 text-gray-500">
            {t("bestLocationsSubtitle", { name: stl.name.toLowerCase() })}
          </p>
          <div className={`mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 ${
            shootType.bestLocations.length <= 2 ? "lg:grid-cols-2" :
            shootType.bestLocations.length === 4 ? "lg:grid-cols-2" :
            "lg:grid-cols-3"
          }`}>
            {shootType.bestLocations.map((loc) => {
              const locR = loc as unknown as Record<string, string | undefined>;
              const locName = locR[`name_${locale}`] || loc.name;
              const reason = locR[`reason_${locale}`] || loc.reason;
              const href = COMBO_OCCASIONS.has(shootType.slug)
                ? `/locations/${loc.slug}/${shootType.slug}`
                : `/locations/${loc.slug}`;
              return (
                <Link
                  key={loc.slug}
                  href={href}
                  className="group rounded-xl border border-warm-200 bg-warm-50 p-5 transition hover:border-primary-300 hover:bg-white hover:shadow-md"
                >
                  <h3 className="font-display text-lg font-bold text-gray-900 group-hover:text-primary-700">
                    {stl.name} {inPrep} {locName}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{reason}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                    {tLoc("viewPhotographers", { location: locName })} →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Real packages — quick book-direct shortcut */}
      {packages.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
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

      {/* FAQ */}
      {stl.faqs.length > 0 && (
        <section className="border-t border-warm-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              {t("faqTitle", { name: stl.name })}
            </h2>
            <div className="mt-8 space-y-4">
              {stl.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-warm-200 bg-warm-50"
                >
                  <summary className="flex items-center justify-between px-6 py-5 font-semibold text-gray-900 cursor-pointer">
                    {faq.question}
                    <svg className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Related blog posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-warm-200 bg-warm-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
          </div>
        </section>
      )}

      {/* Final CTA */}
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
