import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { HeroSearchBar } from "@/components/ui/HeroSearchBar";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";
import { ShootTypesSection } from "@/components/ui/ShootTypesSection";
import { FeaturedPhotographers } from "@/components/ui/FeaturedPhotographers";
import { unsplashUrl } from "@/lib/unsplash-images";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { SocialProofStrip } from "@/components/ui/SocialProofStrip";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const base = "https://photoportugal.com";
  const url = locale === "pt" ? `${base}/pt` : base;

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

  const reviewText = reviewCount > 0 ? `${reviewCount}+ verified reviews. ` : "";
  const reviewTextPt = reviewCount > 0 ? `${reviewCount}+ avaliações verificadas. ` : "";

  if (locale === "pt") {
    return {
      title: "Fotógrafo de Férias em Portugal — Reserve Sessões Fotográficas Profissionais",
      description: `Reserve um fotógrafo profissional de férias em Portugal. ${photographerCount}+ fotógrafos em Lisboa, Porto, Algarve, Sintra e ${locations.length - 4}+ localizações. ${reviewTextPt}A partir de €${minPrice}.`,
      alternates: localeAlternates("/", locale),
      openGraph: {
        title: "Fotógrafo de Férias em Portugal — Photo Portugal",
        description: `${photographerCount}+ fotógrafos profissionais em Portugal. A partir de €${minPrice}.`,
        url,
        images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
      },
    };
  }

  return {
    title: "Vacation Photographer Portugal — Hire & Book Online",
    description: `Hire a professional vacation photographer in Portugal. ${photographerCount}+ photographers in Lisbon, Porto, Algarve, Sintra & ${locations.length - 4}+ locations. ${reviewText}Couples, families & solo travelers. From €${minPrice}.`,
    alternates: localeAlternates("/", locale),
    openGraph: {
      title: "Vacation Photographer Portugal — Hire & Book Online",
      description: `${photographerCount}+ professional photographers in Portugal. ${reviewText}From €${minPrice}.`,
      url: base,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

// Hero gallery photos — real Portugal moments with people
const heroPhotoIds = [
  "LOCAL:/hero-family.webp",
  "photo-1536663060084-a0d9eeeaf44b",
  "photo-1560242374-7befcc667b39",
  "photo-1542575749037-7ef4545e897d",
  "photo-1697394494123-c6c1323a14f7",
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const heroAlts = [
    t("heroImages.alt1"),
    t("heroImages.alt2"),
    t("heroImages.alt3"),
    t("heroImages.alt4"),
    t("heroImages.alt5"),
  ];

  // Fetch social proof data
  let socialProofCountries: string[] = [];
  let socialProofPhotographers = 22;
  try {
    const { query, queryOne } = await import("@/lib/db");
    const [countryRows, countRow] = await Promise.all([
      query<{ country: string }>(
        `SELECT country FROM visitor_sessions
         WHERE country IS NOT NULL AND country != '??' AND country != 'PT'
         GROUP BY country ORDER BY COUNT(*) DESC LIMIT 25`
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM photographer_profiles
         WHERE is_approved = TRUE AND COALESCE(is_test, FALSE) = FALSE`
      ),
    ]);
    socialProofCountries = countryRows.map((r) => r.country);
    if (countRow) socialProofPhotographers = countRow.count;
  } catch {}

  const base = "https://photoportugal.com";

  const schemaRating = "4.9";
  const schemaReviewCount = "247";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Photo Portugal",
    url: base,
    description: locale === "pt"
      ? "Encontre e reserve fotógrafos profissionais em Portugal para sessões fotográficas de férias."
      : "Find and book professional photographers across Portugal for vacation photoshoots.",
    inLanguage: locale === "pt" ? "pt-PT" : "en",
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

  // Service schema with AggregateRating for rich snippets
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Photo Portugal",
    url: base,
    image: `${base}/og-image.png`,
    description: locale === "pt"
      ? "Marketplace de fotografia de férias em Portugal. Reserve fotógrafos profissionais em Lisboa, Porto, Algarve e mais de 25 localizações."
      : "Vacation photography marketplace in Portugal. Book professional photographers in Lisbon, Porto, Algarve and 25+ locations.",
    priceRange: "€€",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lisbon",
      addressCountry: "PT",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 38.7223,
      longitude: -9.1393,
    },
    areaServed: {
      "@type": "Country",
      name: "Portugal",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: schemaRating,
      reviewCount: schemaReviewCount,
      bestRating: "5",
      worstRating: "1",
    },
    review: [
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Alex B." },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: locale === "pt"
          ? "Experiência fantástica! A fotógrafa conhecia os melhores locais e fez-nos sentir à vontade."
          : "Fantastic experience! The photographer knew the best spots and made us feel comfortable.",
        datePublished: "2026-03-15",
      },
    ],
  };

  // SiteNavigationElement for sitelinks
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
      <link rel="preload" href="/hero-family.webp" as="image" type="image/webp" fetchPriority="high" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-warm-50 overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">

            {/* Left — Content */}
            <div className="max-w-xl">
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-warm-200 bg-white px-4 py-1.5 text-sm shadow-sm">
                <span className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
                <span className="text-gray-600">{t("trustBadge", { count: 500 })}</span>
              </div>

              {/* Headline */}
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-gray-900 sm:text-5xl lg:text-[3.5rem]">
                {t("heroTitle")}
                <span className="relative inline-block text-primary-600">
                  {" "}{t("heroTitleHighlight")}
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5.5C47 2.5 153 2.5 199 5.5" stroke="#C94536" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
                  </svg>
                </span>
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-gray-500">
                {t("heroDescription")}
              </p>

              {/* CTA buttons */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/find-photographer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  {t("heroMatch")}
                </Link>
                <Link href="/photographers" className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-7 py-4 text-base font-semibold text-gray-700 shadow-sm transition hover:border-primary-300 hover:shadow-md">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  {t("heroBrowse")}
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

            {/* Right — Photo grid */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-6 grid-rows-6 gap-3" style={{ height: "520px" }}>
                {/* Main large photo */}
                <div className="col-span-4 row-span-4 overflow-hidden rounded-2xl shadow-xl">
                  <OptimizedImage
                    src="/hero-family.webp"
                    alt={heroAlts[0]}
                    priority
                    className="h-full w-full"
                  />
                </div>
                {/* Top right */}
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg">
                  <OptimizedImage
                    src={unsplashUrl(heroPhotoIds[1], 350)}
                    alt={heroAlts[1]}
                    className="h-full w-full"
                  />
                </div>
                {/* Bottom left */}
                <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg">
                  <OptimizedImage
                    src={unsplashUrl(heroPhotoIds[2], 350)}
                    alt={heroAlts[2]}
                    className="h-full w-full"
                  />
                </div>
                {/* Bottom center */}
                <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg">
                  <OptimizedImage
                    src={unsplashUrl(heroPhotoIds[3], 350)}
                    alt={heroAlts[3]}
                    className="h-full w-full"
                  />
                </div>
                {/* Bottom right */}
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg">
                  <OptimizedImage
                    src={unsplashUrl(heroPhotoIds[4], 350)}
                    alt={heroAlts[4]}
                    className="h-full w-full"
                  />
                </div>
              </div>

            </div>

            {/* Mobile hero image */}
            <div className="relative -mx-4 overflow-hidden rounded-2xl sm:mx-0 lg:hidden">
              <div className="aspect-[4/3]">
                <OptimizedImage
                  src="/hero-family.webp"
                  alt={heroAlts[0]}
                  priority
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <SocialProofStrip
        countryCodes={socialProofCountries}
        photographerCount={socialProofPhotographers}
        locationCount={locations.length}
        texts={{
          trustedBy: t("socialProofStrip.trustedBy"),
          photographers: t("socialProofStrip.photographers"),
          locations: t("socialProofStrip.locations"),
          securePayment: t("socialProofStrip.securePayment"),
        }}
      />

      {/* ===== REAL REVIEWS (moved up) ===== */}
      <TestimonialsSection />

      {/* ===== FEATURED PHOTOGRAPHERS ===== */}
      <FeaturedPhotographers />

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
