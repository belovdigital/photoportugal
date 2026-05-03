import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations-data";
import { resolveImageUrl } from "@/lib/image-url";
import { PortfolioMosaic, type MosaicPhoto } from "@/components/ui/PortfolioMosaic";
import { LocationCard } from "@/components/ui/LocationCard";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";
import { ShootTypesSection } from "@/components/ui/ShootTypesSection";
import { FeaturedPhotographers } from "@/components/ui/FeaturedPhotographers";
import { FeaturedQuote } from "@/components/ui/FeaturedQuote";
import { getHomepageReviews, getSiteReviewStats } from "@/lib/reviews-data";
import { heroImages } from "@/lib/hero-images";
import { SocialProofStrip } from "@/components/ui/SocialProofStrip";
import { HeroSingleVariant } from "@/components/ui/HeroSingleVariant";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

// Force-dynamic so the random Hero photographer reshuffles on every request
// rather than getting stuck on whichever person was picked when ISR last ran.
// Cloudflare CDN caches the HTML response briefly (s-maxage in our nginx
// config) which softens the cost.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const base = "https://photoportugal.com";
  const url = locale === "en" ? base : `${base}/${locale}`;
  const t = await getTranslations({ locale, namespace: "homepageMeta" });

  // Pull real numbers for meta descriptions
  let photographerCount = 20;
  let reviewCount = 0;
  let minPrice = 150;
  try {
    const { queryOne } = await import("@/lib/db");
    const stats = await queryOne<{ photographers: number; reviews: number; min_price: number; avg_rating: number }>(`
      SELECT
        (SELECT COUNT(*) FROM photographer_profiles WHERE is_approved = TRUE)::int as photographers,
        (SELECT COUNT(*) FROM reviews WHERE is_approved = TRUE)::int as reviews,
        COALESCE((SELECT MIN(price) FROM packages), 150)::int as min_price,
        COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE is_approved = TRUE), 5.0)::float as avg_rating
    `);
    if (stats) {
      photographerCount = stats.photographers;
      reviewCount = stats.reviews;
      minPrice = stats.min_price;
    }
  } catch {}

  const reviewText = reviewCount > 0 ? t("reviewsCount", { count: reviewCount }) : "";
  const params2 = {
    photographers: photographerCount,
    locations: locations.length - 4,
    reviews: reviewText,
    price: minPrice,
  };

  return {
    title: t("title"),
    description: t("description", params2),
    alternates: localeAlternates("/", locale),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription", params2),
      url,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

// ============================================================
// Async data-dependent sub-sections — wrapped in <Suspense> by HomePage.
// Each resolves independently so the hero renders first and below-fold
// blocks stream in as their queries complete.
// ============================================================

async function SchemaLdScripts({ locale }: { locale: string }) {
  const [siteStats, schemaReviews, t] = await Promise.all([
    getSiteReviewStats(),
    getHomepageReviews(3, locale),
    getTranslations({ locale, namespace: "homepageMeta" }),
  ]);
  const base = "https://photoportugal.com";
  const schemaRating = siteStats.avgRating.toFixed(1);
  const schemaReviewCount = String(siteStats.count);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Photo Portugal",
    url: base,
    description: t("schemaWebsite"),
    inLanguage: t("inLanguage"),
    publisher: {
      "@type": "Organization",
      name: "Photo Portugal",
      logo: { "@type": "ImageObject", url: `${base}/logo.svg` },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${base}/photographers?location={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Photo Portugal",
    url: base,
    image: `${base}/og-image.png`,
    description: t("schemaService"),
    priceRange: "€€",
    address: { "@type": "PostalAddress", addressLocality: "Lisbon", addressCountry: "PT" },
    geo: { "@type": "GeoCoordinates", latitude: 38.7223, longitude: -9.1393 },
    areaServed: { "@type": "Country", name: "Portugal" },
    ...(siteStats.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: schemaRating,
        reviewCount: schemaReviewCount,
        bestRating: "5",
        worstRating: "1",
      },
      review: schemaReviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.client_name || "Verified traveler" },
        reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5", worstRating: "1" },
        reviewBody: r.text,
        datePublished: new Date(r.created_at).toISOString().slice(0, 10),
      })),
    }),
  };

  const navJsonLd = {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: ["Photographers", "Locations", "How It Works", "FAQ", "Pricing", "Blog", "Join"],
    url: [
      `${base}/photographers`,
      `${base}/locations`,
      `${base}/how-it-works`,
      `${base}/faq`,
      `${base}/pricing`,
      `${base}/blog`,
      `${base}/join`,
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }} />
    </>
  );
}

async function SocialProofSection({
  texts,
}: {
  texts: {
    photographers: string;
    portugalWide: string;
    coverage: string;
    verified: string;
    verifiedSub: string;
    realProfiles: string;
    securePayment: string;
    directBooking: string;
    islandsCovered: string;
  };
}) {
  let socialProofPhotographers = 22;
  let socialProofAvatars: { slug: string; avatar_url: string; name: string }[] = [];
  try {
    const { query, queryOne } = await import("@/lib/db");
    const [countRow, avatarRows] = await Promise.all([
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM photographer_profiles
         WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
      ),
      query<{ slug: string; avatar_url: string; name: string }>(
        `SELECT pp.slug, u.avatar_url, u.name FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
           AND u.avatar_url IS NOT NULL
         ORDER BY RANDOM()
         LIMIT 30`
      ),
    ]);
    if (countRow) socialProofPhotographers = countRow.count;
    socialProofAvatars = avatarRows;
  } catch {}

  return (
    <SocialProofStrip
      photographerCount={socialProofPhotographers}
      avatars={socialProofAvatars}
      texts={texts}
    />
  );
}

// Skeleton matches SocialProofStrip vertical size to avoid CLS while streaming.
function SocialProofSkeleton() {
  return (
    <section className="border-y border-warm-200 bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3 md:gap-10">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-11 w-36 animate-pulse rounded bg-warm-200/60" />
              <div className="mt-3 h-3 w-48 animate-pulse rounded bg-warm-200/60" />
              <div className="mt-5 h-16 w-full max-w-[310px] animate-pulse rounded-lg bg-warm-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function FeaturedQuoteBlock({ locale }: { locale: string }) {
  const reviews = await getHomepageReviews(1, locale);
  const review = reviews[0];
  if (!review) return null;
  return (
    <div className="mb-10">
      <FeaturedQuote review={review} invert />
    </div>
  );
}

// ============================================================
// Main page — no blocking DB awaits; hero renders immediately,
// async sections stream via <Suspense>.
// ============================================================

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");

  // Hero is now always Variant B (single-photographer hero won the AB test —
  // bounce −14pp, engagement +74%). The collage that used to be Variant A has
  // been reformatted into a value-prop section below the hero so we keep the
  // generic SEO copy + 5-photo brand visual that lived there.
  // The `ab_hero` cookie is still set in middleware for any back-compat
  // analytics, but the page no longer branches on it.

  const heroCovers = heroImages.map((h) => ({
    cover_url: h.url,
    slug: h.photographerSlug,
    name: h.photographerName,
    alt: h.alt,
  }));

  // Real total photographer count for the "browse all N" link in the hero.
  // We render whatever's in the DB right now — no "+" suffix — so the
  // number stays honest as the roster grows.
  let totalPhotographers = 0;
  try {
    const { queryOne } = await import("@/lib/db");
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM photographer_profiles
       WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
    );
    totalPhotographers = row?.count ?? 0;
  } catch {}

  // Server picks ONE featured/verified/founding photographer per ISR cycle (60s).
  // Going server-side rather than client-rolling avoids the flash-of-wrong-content
  // we used to get on hydration (SSR rendered the first photographer, useEffect
  // then swapped to a random one — visible swap on every page load).
  let heroPhotographer: import("@/components/ui/HeroSingleVariant").HeroFeaturedPhotographer | null = null;
  try {
    const { query: q } = await import("@/lib/db");
    const rows = await q<{
      slug: string; name: string; tagline: string | null;
      cover_url: string | null; avatar_url: string | null;
      rating: string; review_count: number; session_count: number;
      location_slug: string | null; portfolio_urls: string[] | null;
    }>(
      (() => {
        const TR = new Set(["pt", "de", "es", "fr"]);
        const useLoc = TR.has(locale) ? locale : null;
        const taglineSql = useLoc ? `COALESCE(pp.tagline_${useLoc}, pp.tagline)` : "pp.tagline";
        return `SELECT pp.slug, u.name, ${taglineSql} as tagline, pp.cover_url, u.avatar_url,
              COALESCE(pp.rating, 0)::text as rating,
              COALESCE(pp.review_count, 0) as review_count,
              COALESCE(pp.session_count, 0) as session_count,
              (SELECT loc_row.location_slug FROM photographer_locations loc_row WHERE loc_row.photographer_id = pp.id LIMIT 1) as location_slug,
              ARRAY(SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY pi.sort_order NULLS LAST, pi.created_at LIMIT 12) as portfolio_urls
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo')
       -- Weighted random pick (Efraimidis-Spirakis sampling): higher tier =
       -- higher probability of being chosen, but not a hard priority. Alexandru
       -- (sole Featured) gets ~50% of impressions, Verified ~30%, Founding ~15%,
       -- early-bird ~5%, the rest of approved photographers ~2%. Tweak the
       -- weights to shift the distribution.
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 1`;
      })()
    );
    if (rows.length > 0) {
      const r = rows[0];
      const locData = r.location_slug ? locations.find((l) => l.slug === r.location_slug) : null;
      heroPhotographer = {
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        cover_url: r.cover_url,
        avatar_url: r.avatar_url,
        rating: Number(r.rating),
        review_count: r.review_count,
        session_count: r.session_count,
        location_name: locData?.name || "Portugal",
        location_slug: r.location_slug || "",
        portfolio_urls: (r.portfolio_urls || []).filter(Boolean),
      };
    }
  } catch {}

  // Pool of portfolio photos for the auto-rotating mosaic in the value-prop
  // section. ~24 photos pulled from the same weighted-tier pool the hero
  // uses, so the section showcases real (and skewed-toward-paid) work.
  // Each photo carries the photographer's slug so cells link back to /photographers/{slug}.
  let mosaicPhotos: MosaicPhoto[] = [];
  try {
    const { query: q } = await import("@/lib/db");
    const rows = await q<{
      url: string; slug: string; name: string; location_slug: string | null;
    }>(
      `SELECT pi.url, pp.slug, u.name,
              (SELECT pl.location_slug FROM photographer_locations pl WHERE pl.photographer_id = pp.id LIMIT 1) AS location_slug
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       JOIN portfolio_items pi ON pi.photographer_id = pp.id AND pi.type = 'photo'
       WHERE pp.is_approved = TRUE
         AND COALESCE(pp.is_test, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
       ORDER BY -LN(RANDOM()) / (CASE
         WHEN pp.is_featured THEN 50
         WHEN pp.is_verified THEN 30
         WHEN COALESCE(pp.is_founding, FALSE) THEN 15
         WHEN pp.early_bird_tier IS NOT NULL THEN 5
         ELSE 2
       END) ASC
       LIMIT 48`
    );
    mosaicPhotos = rows.map((r) => {
      const locData = r.location_slug ? locations.find((l) => l.slug === r.location_slug) : null;
      return { url: r.url, slug: r.slug, name: r.name, location: locData?.name || null };
    });
  } catch {}

  // LCP image preload hint (desktop only via media query). Must match the URL
  // that the hero will actually render first — that's the live photographer's
  // first portfolio photo, falling back to their cover, and only then to the
  // static brand image. If we preload the static fallback while the hero
  // renders a different live photo, the browser logs "preloaded but not used"
  // and we waste bandwidth on an image nobody sees.
  const heroFirstPhoto = heroPhotographer?.portfolio_urls?.[0]
    || heroPhotographer?.cover_url
    || heroCovers[0].cover_url;
  const lcpSrc = resolveImageUrl(heroFirstPhoto);
  const lcpSrcset: string | undefined = undefined;

  const socialProofTexts = {
    photographers: t("socialProofStrip.photographers"),
    portugalWide: t("socialProofStrip.portugalWide"),
    coverage: t("socialProofStrip.coverage"),
    verified: t("socialProofStrip.verified"),
    verifiedSub: t("socialProofStrip.verifiedSub"),
    realProfiles: t("socialProofStrip.realProfiles"),
    securePayment: t("socialProofStrip.securePayment"),
    directBooking: t("socialProofStrip.directBooking"),
    islandsCovered: t("socialProofStrip.islandsCovered"),
  };

  return (
    <>
      {/* Preload the desktop hero LCP image. media query so mobile (where collage is display:none) never fetches it. */}
      <link
        rel="preload"
        as="image"
        href={lcpSrc}
        {...(lcpSrcset ? { imageSrcSet: lcpSrcset, imageSizes: "(min-width: 1280px) 800px, 60vw" } : {})}
        fetchPriority="high"
        media="(min-width: 1024px)"
      />

      {/* JSON-LD schema scripts — data-dependent, streamed via Suspense so they don't block initial paint. */}
      <Suspense fallback={null}>
        <SchemaLdScripts locale={locale} />
      </Suspense>

      {/* ===== HERO ===== Single photographer, picked fresh per request. */}
      {heroPhotographer && (
        <HeroSingleVariant
          photographer={heroPhotographer}
          totalPhotographers={totalPhotographers}
        />
      )}

      {/* ===== Value prop + photo collage =====
          Reformatted version of the old Variant A. H1 lives in the hero now,
          so this section uses H2 and is positioned for SEO copy + the
          5-photo brand visual that fronted the site for the first months.
          NB: no `overflow-hidden` on this section — it would confine the
          left column's `position: sticky` to the section's own bounds and
          kill the sticky effect. */}
      <section className="relative bg-warm-50">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Left text column is `lg:sticky` and pinned near the top of the
              viewport while the right mosaic scrolls. `items-start` is required
              for sticky to work (the default `items-stretch` makes the left
              column as tall as the right one, which would defeat sticky). The
              right mosaic is intentionally taller than a viewport so the
              sticky effect is noticeable; once its bottom passes the sticky
              top, the left column unsticks and scroll continues normally. */}
          <div className="grid grid-cols-1 items-start gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">

            {/* Left — text/CTAs, sticks to the top while user scrolls past
                the right mosaic. */}
            <div className="max-w-xl lg:sticky lg:top-24">
              {/* Trust badge — scrolls to reviews section */}
              <a
                href="#reviews"
                className="group inline-flex items-center gap-2 rounded-full border border-warm-200 bg-white px-4 py-1.5 text-sm shadow-sm transition hover:border-primary-300 hover:shadow-md"
              >
                <span className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
                <span className="text-gray-600 group-hover:text-gray-900">{t("trustBadge", { count: 500 })}</span>
                <svg className="h-3 w-3 text-gray-400 transition group-hover:translate-y-0.5 group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </a>

              {/* Page H1 lives here (NOT in the hero) — the hero shows a
                  random photographer with a name-specific subhead, which
                  rotates per request and would dilute SEO if it were the
                  page's primary heading. The stable copy below ("Book a
                  Vacation Photographer in Portugal") is the canonical h1. */}
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-gray-900 sm:text-5xl lg:text-[3.5rem]">
                {t("heroTitle")}{" "}
                <span className="relative inline-block text-primary-600">
                  {t("heroTitleHighlight")}
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5.5C47 2.5 153 2.5 199 5.5" stroke="#C94536" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
                  </svg>
                </span>
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-gray-500">
                {t("heroDescription")}
              </p>

              {/* CTAs: send to catalog or how-it-works. Match form lives in
                  the hero above — duplicating it here would just confuse. */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/photographers"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700"
                >
                  {t("valuePropBrowseAll")}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-warm-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 transition hover:border-primary-300 hover:bg-warm-50"
                >
                  {t("valuePropHowItWorks")}
                </Link>
              </div>

              {/* Social proof row */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{t("socialProof.handPicked")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{t("socialProof.verifiedReviews")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{t("socialProof.securePayments")}</span>
                </div>
              </div>
            </div>

            {/* Right — auto-rotating portfolio mosaic. Fixed height taller
                than a typical viewport (140vh) so the left column has room
                to stick while the user scrolls past it. */}
            <div className="hidden lg:block lg:h-[140vh]">
              <PortfolioMosaic photos={mosaicPhotos.slice(0, 24)} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== (streamed) */}
      <Suspense fallback={<SocialProofSkeleton />}>
        <SocialProofSection texts={socialProofTexts} />
      </Suspense>

      {/* ===== FEATURED PHOTOGRAPHERS (self-fetching) ===== */}
      <Suspense fallback={null}>
        <FeaturedPhotographers locale={locale} />
      </Suspense>

      {/* ===== REAL REVIEWS (self-fetching) ===== */}
      <Suspense fallback={null}>
        <TestimonialsSection locale={locale} />
      </Suspense>

      {/* ===== HOW IT WORKS ===== */}
      <HowItWorksSection />

      {/* ===== SHOOT TYPES ===== */}
      <ShootTypesSection />

      {/* ===== LOCATIONS ===== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-warm-200 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-warm-700">
            {t("locations.badge")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("locations.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            {t("locations.subtitle")}
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.slice(0, 6).map((location) => (
            <LocationCard key={location.slug} location={location} locale={locale} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/locations"
            className="inline-flex items-center gap-2 rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            {t("locations.viewAll", { count: locations.length })}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative overflow-hidden bg-gray-900 -mb-16 sm:-mb-24">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <Suspense fallback={null}>
            <FeaturedQuoteBlock locale={locale} />
          </Suspense>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">
            {t("cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/choose-booking-type"
              className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("cta.browsePhotographers")}
            </Link>
            <Link
              href="/find-photographer"
              className="rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              {t("cta.findMePhotographer")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
