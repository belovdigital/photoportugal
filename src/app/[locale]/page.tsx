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
      description: `Reserve um fotógrafo profissional de férias em Portugal. ${photographerCount}+ fotógrafos em ${locations.length} localizações. ${reviewTextPt}A partir de €${minPrice}.`,
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
    description: `Hire a professional vacation photographer in Portugal. ${photographerCount}+ photographers across ${locations.length} locations. ${reviewText}Couples, families & solo travelers. From €${minPrice}.`,
    alternates: localeAlternates("/", locale),
    openGraph: {
      title: "Vacation Photographer Portugal — Hire & Book Online | Photo Portugal",
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
      <link rel="preload" href="/hero-family.webp" as="image" type="image/webp" />
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

              {/* Search */}
              <div className="mt-8">
                <HeroSearchBar locations={locations.map(l => ({ slug: l.slug, name: l.name }))} />
              </div>

              {/* Social proof row */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{t("socialProof.verifiedReviews")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{t("socialProof.payAfterHappy")}</span>
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

              {/* Floating review card */}
              <div className="absolute -left-6 bottom-8 rounded-xl border border-warm-200 bg-white p-4 shadow-lg" style={{ maxWidth: "240px" }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-gray-900">5.0</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                  &ldquo;{t("floatingReview.text")}&rdquo;
                </p>
                <p className="mt-1 text-[11px] text-gray-400">{t("floatingReview.author")} &middot; {t("floatingReview.location")}</p>
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

      {/* ===== STATS ===== */}
      <section className="border-y border-warm-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-6 px-4 py-10 sm:px-6 lg:gap-8 lg:px-8">
          {[
            {
              value: `${locations.length}`,
              label: t("stats.stunningLocations"),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
              color: "text-primary-500 bg-primary-50",
            },
            {
              value: "5.0",
              label: t("stats.averageRating"),
              icon: <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />,
              color: "text-yellow-500 bg-yellow-50",
              filled: true,
            },
            {
              value: "100%",
              label: t("stats.paymentProtection"),
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
              color: "text-accent-500 bg-accent-50",
            },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                <svg className="h-5 w-5" fill={stat.filled ? "currentColor" : "none"} viewBox={stat.filled ? "0 0 20 20" : "0 0 24 24"} stroke={stat.filled ? undefined : "currentColor"}>
                  {stat.icon}
                </svg>
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

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

      {/* ===== TESTIMONIALS ===== */}
      <TestimonialsSection />

      {/* ===== CTA ===== */}
      <section className="relative overflow-hidden bg-gray-900">
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
              href="/photographers"
              className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("cta.browsePhotographers")}
            </Link>
            <Link
              href="/join"
              className="rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              {t("cta.joinAsPhotographer")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
