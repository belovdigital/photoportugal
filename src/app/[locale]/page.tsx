import { Suspense } from "react";
import { cookies } from "next/headers";
import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";
import { ShootTypesSection } from "@/components/ui/ShootTypesSection";
import { FeaturedPhotographers } from "@/components/ui/FeaturedPhotographers";
import { FeaturedQuote } from "@/components/ui/FeaturedQuote";
import { getHomepageReviews, getSiteReviewStats } from "@/lib/reviews-data";
import { heroImages } from "@/lib/hero-images";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { SocialProofStrip } from "@/components/ui/SocialProofStrip";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";
import { HeroSingleVariant } from "@/components/ui/HeroSingleVariant";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 60;

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
  texts: { trustedBy: string; photographers: string; locations: string; securePayment: string; islandsCovered: string };
}) {
  let socialProofCountries: string[] = [];
  let socialProofPhotographers = 22;
  let socialProofAvatars: { slug: string; avatar_url: string; name: string }[] = [];
  let socialProofLocationSlugs: string[] = [];
  try {
    const { query, queryOne } = await import("@/lib/db");
    const [countryRows, countRow, avatarRows, locRows] = await Promise.all([
      query<{ country: string }>(
        `WITH top_countries AS (
           SELECT country, COUNT(*) as visits FROM visitor_sessions
           WHERE country IS NOT NULL AND country != '??' AND country != 'PT'
           GROUP BY country ORDER BY visits DESC LIMIT 25
         )
         SELECT country FROM top_countries ORDER BY RANDOM()`
      ),
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
      query<{ location_slug: string }>(
        `SELECT DISTINCT location_slug FROM photographer_locations
         JOIN photographer_profiles pp ON pp.id = photographer_locations.photographer_id
         WHERE pp.is_approved = TRUE`
      ),
    ]);
    socialProofCountries = countryRows.map((r) => r.country);
    if (countRow) socialProofPhotographers = countRow.count;
    socialProofAvatars = avatarRows;
    socialProofLocationSlugs = locRows.map((r) => r.location_slug);
  } catch {}

  return (
    <SocialProofStrip
      countryCodes={socialProofCountries}
      photographerCount={socialProofPhotographers}
      locationCount={locations.length}
      avatars={socialProofAvatars}
      locationSlugs={socialProofLocationSlugs}
      texts={texts}
    />
  );
}

// Skeleton matches SocialProofStrip vertical size to avoid CLS while streaming.
function SocialProofSkeleton() {
  return (
    <section className="border-y border-warm-200 bg-warm-50/50 py-8 sm:py-14 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-3 text-center sm:gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="h-10 w-16 rounded bg-warm-200/60 animate-pulse sm:h-14 sm:w-20" />
              <div className="mt-2 h-3 w-24 rounded bg-warm-200/60 animate-pulse" />
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

  // Read A/B variant from cookie SERVER-SIDE so the right hero is rendered
  // on first paint (no flicker, no client-script race). The inline script below
  // only runs to (a) write the cookie on first visit, (b) handle ?ab= overrides.
  const cookieStore = await cookies();
  const cookieVariant = cookieStore.get("ab_hero")?.value;
  const initialVariant: "A" | "B" =
    cookieVariant === "A" || cookieVariant === "B" ? cookieVariant : "A";

  const heroCovers = heroImages.map((h) => ({
    cover_url: h.url,
    slug: h.photographerSlug,
    name: h.photographerName,
    alt: h.alt,
  }));

  // Rotating featured photographer for Hero variant B (single-photographer layout).
  // Picked randomly each ISR refresh (every 60s) so different visitors see different people.
  let featuredPhotographer: import("@/components/ui/HeroSingleVariant").HeroFeaturedPhotographer | null = null;
  try {
    const { query: q } = await import("@/lib/db");
    const rows = await q<{
      slug: string; name: string; tagline: string | null;
      cover_url: string | null; avatar_url: string | null;
      rating: string; review_count: number; session_count: number;
      location_slug: string | null; hero_photo_url: string | null;
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
              -- Pick a RANDOM portfolio photo (full-res pro work). Cover_url often tiny (400-600px), unusable for hero.
              (SELECT pi.url FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo' ORDER BY RANDOM() LIMIT 1) as hero_photo_url
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE
         AND EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.photographer_id = pp.id AND pi.type = 'photo')
       ORDER BY pp.is_featured DESC, RANDOM()
       LIMIT 1`;
      })()
    );
    if (rows.length > 0) {
      const r = rows[0];
      // Resolve location slug → human name via our locations-data
      const locData = r.location_slug ? locations.find(l => l.slug === r.location_slug) : null;
      featuredPhotographer = {
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        // Always use a random portfolio photo — covers are too small for full-screen hero
        cover_url: r.hero_photo_url,
        avatar_url: r.avatar_url,
        rating: Number(r.rating),
        review_count: r.review_count,
        session_count: r.session_count,
        location_name: locData?.name || "Portugal",
        location_slug: r.location_slug || "",
      };
    }
  } catch {}

  // Build LCP image URLs for preload hint (desktop only via media query).
  // Must match OptimizedImage's getOptimizedSrc output (width=1200, q=82, f=webp) + srcset widths.
  const lcpPath = heroCovers[0].cover_url.replace("/uploads/", "");
  const lcpSrc = `/api/img/${lcpPath}?w=1200&q=82&f=webp`;
  const lcpSrcset = [400, 800, 1200].map((w) => `/api/img/${lcpPath}?w=${w}&q=82&f=webp ${w}w`).join(", ");

  const socialProofTexts = {
    trustedBy: t("socialProofStrip.trustedBy"),
    photographers: t("socialProofStrip.photographers"),
    locations: t("socialProofStrip.locations"),
    securePayment: t("socialProofStrip.securePayment"),
    islandsCovered: t("socialProofStrip.islandsCovered"),
  };

  return (
    <>
      {/* Preload the desktop hero LCP image. media query so mobile (where collage is display:none) never fetches it. */}
      <link
        rel="preload"
        as="image"
        href={lcpSrc}
        imageSrcSet={lcpSrcset}
        imageSizes="(min-width: 1280px) 800px, 60vw"
        fetchPriority="high"
        media="(min-width: 1024px)"
      />

      {/* JSON-LD schema scripts — data-dependent, streamed via Suspense so they don't block initial paint. */}
      <Suspense fallback={null}>
        <SchemaLdScripts locale={locale} />
      </Suspense>

      {/* ===== HERO A/B TEST =====
          Server picks variant from cookie (initialVariant). Only one hero is
          rendered → no flicker, no race with client script. The inline script
          handles cookie write on first visit + ?ab= overrides; if it changes
          variant after paint the page reloads with the right server-rendered hero. */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          try {
            var qs = new URLSearchParams(location.search);
            var override = qs.get('ab');
            var current = ${JSON.stringify(initialVariant)};
            // ?ab=reset clears the cookie and re-rolls
            if (override === 'reset') {
              document.cookie = 'ab_hero=;path=/;max-age=0;SameSite=Lax';
              var nv = Math.random() < 0.5 ? 'A' : 'B';
              document.cookie = 'ab_hero=' + nv + ';path=/;max-age=' + (60*60*24*30) + ';SameSite=Lax';
              console.log('[ab_hero] reset → rolled', nv);
              if (nv !== current) location.replace(location.pathname);
              return;
            }
            if (override === 'A' || override === 'B') {
              document.cookie = 'ab_hero=' + override + ';path=/;max-age=' + (60*60*24*30) + ';SameSite=Lax';
              console.log('[ab_hero] sticky override →', override);
              if (override !== current) location.replace(location.pathname);
              return;
            }
            // First visit: no cookie yet → roll one for next pageview's SSR
            var m = document.cookie.match(/(?:^|; )ab_hero=(A|B)/);
            if (!m) {
              var v = Math.random() < 0.5 ? 'A' : 'B';
              document.cookie = 'ab_hero=' + v + ';path=/;max-age=' + (60*60*24*30) + ';SameSite=Lax';
              console.log('[ab_hero] new visitor → rolled', v, '(showing A this pageview, cookie set for next)');
            }
          } catch(e) {}
        })();
      ` }} />

      {initialVariant === "B" && featuredPhotographer ? (
        <HeroSingleVariant photographer={featuredPhotographer} />
      ) : (
      <section className="relative bg-warm-50 overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">

            {/* Left — Content */}
            <div className="max-w-xl">
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

              {/* Headline */}
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

              {/* Inline match CTA — replaces old two-button hero */}
              <div className="mt-8">
                <MatchQuickForm source="homepage_hero_a" size="lg" />
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

            {/* Right — Photo grid built from real photographer portfolio photos.
                `hidden lg:block` hides on mobile (display:none) so lazy-loaded images aren't fetched.
                The first image's fetch is driven by the <link rel="preload"> at the top (media-gated to desktop).
                Grid math at max-w-7xl: main ~800px, side tall ~400px, side square ~400px. */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-6 grid-rows-6 gap-3" style={{ height: "520px" }}>
                <Link
                  href={`/photographers/${heroCovers[0].slug}`}
                  className="col-span-4 row-span-4 overflow-hidden rounded-2xl shadow-xl group"
                >
                  <OptimizedImage
                    src={heroCovers[0].cover_url}
                    alt={heroCovers[0].alt}
                    width={1200}
                    quality={82}
                    sizes="(min-width: 1280px) 800px, 60vw"
                    className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                  />
                </Link>
                <Link
                  href={`/photographers/${heroCovers[1].slug}`}
                  className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg group"
                >
                  <OptimizedImage
                    src={heroCovers[1].cover_url}
                    alt={heroCovers[1].alt}
                    width={800}
                    quality={82}
                    sizes="(min-width: 1280px) 400px, 30vw"
                    className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                  />
                </Link>
                <Link
                  href={`/photographers/${heroCovers[2].slug}`}
                  className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg group"
                >
                  <OptimizedImage
                    src={heroCovers[2].cover_url}
                    alt={heroCovers[2].alt}
                    width={800}
                    quality={82}
                    sizes="(min-width: 1280px) 400px, 30vw"
                    className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                  />
                </Link>
                <Link
                  href={`/photographers/${heroCovers[3].slug}`}
                  className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg group"
                >
                  <OptimizedImage
                    src={heroCovers[3].cover_url}
                    alt={heroCovers[3].alt}
                    width={800}
                    quality={82}
                    sizes="(min-width: 1280px) 400px, 30vw"
                    className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                  />
                </Link>
                <Link
                  href={`/photographers/${heroCovers[4].slug}`}
                  className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg group"
                >
                  <OptimizedImage
                    src={heroCovers[4].cover_url}
                    alt={heroCovers[4].alt}
                    width={800}
                    quality={82}
                    sizes="(min-width: 1280px) 400px, 30vw"
                    className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ===== SOCIAL PROOF ===== (streamed) */}
      <Suspense fallback={<SocialProofSkeleton />}>
        <SocialProofSection texts={socialProofTexts} />
      </Suspense>

      {/* ===== REAL REVIEWS (self-fetching) ===== */}
      <Suspense fallback={null}>
        <TestimonialsSection locale={locale} />
      </Suspense>

      {/* ===== FEATURED PHOTOGRAPHERS (self-fetching) ===== */}
      <Suspense fallback={null}>
        <FeaturedPhotographers locale={locale} />
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
