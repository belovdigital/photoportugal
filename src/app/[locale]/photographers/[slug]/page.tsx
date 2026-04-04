import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";
import { PortfolioGallery } from "@/components/photographers/PortfolioGallery";
import { AskQuestionButton } from "@/components/ui/AskQuestionButton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ReviewsPaginated } from "@/components/ui/ReviewsPaginated";
import { PackageCard } from "@/components/ui/PackageCard";
import { localeAlternates } from "@/lib/seo";
import { normalizeName } from "@/lib/format-name";

export const dynamicParams = true;
export const revalidate = 86400; // ISR: revalidate every 24 hours

async function getPhotographer(slug: string, isAdmin = false) {
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
    }>(
      `SELECT p.id, p.slug, u.name, p.tagline, p.bio, u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              p.experience_years, p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding, p.is_approved, p.plan,
              p.rating, p.review_count, p.session_count, u.last_seen_at
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1`,
      [slug]
    );
    if (!profile || (!profile.is_approved && !isAdmin)) return null;

    const locationRows = await query<{ location_slug: string }>(
      "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    );
    const locs = locationRows
      .map((r) => allLocations.find((l) => l.slug === r.location_slug))
      .filter((l): l is (typeof allLocations)[number] => l !== undefined);

    const pkgs = await query<{
      id: string;
      name: string;
      description: string | null;
      duration_minutes: number;
      num_photos: number;
      price: number;
      is_popular: boolean;
      delivery_days: number;
    }>(
      "SELECT id, name, description, duration_minutes, num_photos, price, is_popular, COALESCE(delivery_days, 7) as delivery_days FROM packages WHERE photographer_id = $1 AND is_public = TRUE ORDER BY sort_order, price",
      [profile.id]
    );

    const planLimits: Record<string, number> = { free: 10, pro: 30, premium: 100 };
    const photoLimit = planLimits[profile.plan] || 10;

    const portfolioItems = await query<{ url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null }>(
      "SELECT url, thumbnail_url, caption, location_slug, shoot_type FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at ASC LIMIT $2",
      [profile.id, photoLimit]
    );

    return {
      type: "db" as const,
      data: {
        ...profile,
        locations: locs,
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
  const result = await getPhotographer(slug);
  if (!result) return {};

  const t = await getTranslations({ locale, namespace: "photographers.profile" });

  const p = result.data;
  const locationNames = (p.locations || []).map((l: { name: string }) => l.name).join(", ");
  const title = t("metaTitle", { name: normalizeName(p.name), locations: locationNames || "Portugal" });
  const topShootTypes = (p.shoot_types || []).slice(0, 2);
  const shootTypeText = topShootTypes.length > 0 ? ` Specializing in ${topShootTypes.join(" & ").toLowerCase()} photography.` : "";
  const description = `${t("metaDescription", { name: normalizeName(p.name), locations: locationNames || "Portugal" })}${shootTypeText} ${p.tagline || ""}`.trim();
  const rawImage = p.cover_url || p.avatar_url;
  const ogImage = rawImage ? `https://photoportugal.com/api/img/${rawImage.replace("/uploads/", "")}?w=1200&h=630&f=jpeg&q=80` : "https://photoportugal.com/og-image.png";
  return {
    title,
    description,
    alternates: localeAlternates(`/photographers/${slug}`, locale),
    openGraph: {
      title,
      description,
      type: "profile",
      url: `https://photoportugal.com/photographers/${slug}`,
      images: [{ url: ogImage, alt: title }],
    },
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

  const isPreview = !!process.env.ADMIN_PREVIEW_SECRET && sp.preview === process.env.ADMIN_PREVIEW_SECRET;
  const result = await getPhotographer(slug, isPreview);

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
  let reviews: { id: string; rating: number; title: string | null; text: string | null; is_verified: boolean; created_at: string; client_name: string; client_avatar: string | null }[] = [];
  const portfolioItems = (photographer as { portfolioItems?: { url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null }[] }).portfolioItems || [];

  // Fetch real reviews from DB for DB photographers
  if (result.type === "db") {
    try {
      const dbReviews = await query<{
        id: string;
        rating: number;
        title: string | null;
        text: string | null;
        is_verified: boolean;
        created_at: string;
        client_name: string;
        client_avatar: string | null;
        photos: { id: string; url: string }[];
        video_url: string | null;
      }>(
        `SELECT r.id, r.rating, r.title, r.text, r.is_verified, r.created_at, r.video_url,
                COALESCE(r.client_name_override, u.name, 'Client') as client_name,
                u.avatar_url as client_avatar,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', rp.id, 'url', rp.url) ORDER BY rp.created_at)
                   FROM review_photos rp WHERE rp.review_id = r.id AND rp.is_public = true),
                  '[]'::json
                ) as photos
         FROM reviews r
         LEFT JOIN users u ON u.id = r.client_id
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
      }));
    } catch {}
  }

  // Fetch similar photographers who serve the same locations
  let similarPhotographers: {
    id: string; slug: string; name: string; avatar_url: string | null;
    cover_url: string | null; tagline: string | null; rating: number; review_count: number;
    starting_price: number | null; languages: string[];
    location_names: string[];
  }[] = [];
  const primaryLocation = photographer.locations?.[0];
  if (result.type === "db") {
    try {
      similarPhotographers = await query<{
        id: string; slug: string; name: string; avatar_url: string | null;
        cover_url: string | null; tagline: string | null; rating: number; review_count: number;
        starting_price: number | null; languages: string[];
        location_names: string[];
      }>(
        `SELECT DISTINCT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url,
                pp.tagline, pp.rating, pp.review_count, pp.languages,
                (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE) as starting_price,
                ARRAY(SELECT l.location_slug FROM photographer_locations l WHERE l.photographer_id = pp.id LIMIT 3) as location_names
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         WHERE pp.is_approved = TRUE
         AND pp.id != $1
         AND pp.id IN (
           SELECT photographer_id FROM photographer_locations
           WHERE location_slug IN (SELECT location_slug FROM photographer_locations WHERE photographer_id = $1)
         )
         ORDER BY pp.rating DESC, pp.review_count DESC
         LIMIT 3`,
        [photographer.id]
      );
    } catch {}
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: normalizeName(photographer.name),
    description: photographer.bio || photographer.tagline,
    url: `https://photoportugal.com/photographers/${slug}`,
    image: photographer.cover_url || photographer.avatar_url || undefined,
    priceRange: photographer.packages?.length > 0 ? `From €${Math.round(Math.min(...photographer.packages.map((pkg: { price: number }) => Number(pkg.price))))}` : undefined,
    aggregateRating: photographer.review_count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: photographer.rating,
          reviewCount: photographer.review_count,
          bestRating: 5,
        }
      : undefined,
    ...(reviews.length > 0
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.client_name },
            reviewRating: { "@type": "Rating", ratingValue: r.rating },
            reviewBody: r.text || r.title || "",
            datePublished: new Date(r.created_at).toISOString().split("T")[0],
          })),
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

  const productJsonLd = (photographer.packages || []).map(
    (pkg: { name: string; description: string | null; price: number }) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: pkg.name,
      description: pkg.description || t("packageDescription", { packageName: pkg.name, name: normalizeName(photographer.name) }),
      offers: {
        "@type": "Offer",
        price: String(pkg.price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `https://photoportugal.com/photographers/${slug}`,
      },
    })
  );

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

  return (
    <>
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
      {productJsonLd.map((product: Record<string, unknown>, idx: number) => (
        <script
          key={`product-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
        />
      ))}

      {/* Hero — no banner */}
      <div className="bg-warm-50 pt-8 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full ring-4 ring-white bg-primary-100 text-3xl font-bold text-primary-600 sm:h-28 sm:w-28 overflow-hidden shadow-md">
                {photographer.avatar_url ? (
                  <OptimizedImage src={photographer.avatar_url} alt={normalizeName(photographer.name)} width={400} priority className="h-full w-full" />
                ) : (
                  normalizeName(photographer.name).charAt(0)
                )}
              </div>
              {result.type === "db" && (photographer as { last_seen_at?: string }).last_seen_at && (Date.now() - new Date((photographer as { last_seen_at: string }).last_seen_at).getTime()) < 5 * 60 * 1000 && (
                <span className="absolute bottom-1 right-1 flex h-4 w-4 rounded-full ring-[3px] ring-white bg-green-500" title={tc("online")} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Name + badges */}
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

              {/* Tagline + rating */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {photographer.tagline && (
                  <p className="text-sm text-gray-500">{photographer.tagline}</p>
                )}
                {photographer.review_count > 0 && (
                  <a href="#reviews" className="flex items-center gap-1 text-sm transition hover:text-primary-600">
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
              </div>

              {/* Locations as pill tags */}
              {photographer.locations && photographer.locations.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {photographer.locations.map((loc: { slug: string; name: string }) => (
                    <Link key={loc.slug} href={`/locations/${loc.slug}`} className="inline-flex items-center gap-1 rounded-full bg-warm-100 px-3 py-1.5 text-xs font-medium text-warm-700 transition hover:bg-warm-200 hover:text-primary-600">
                      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {loc.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Experience, languages, sessions */}
              {(photographer.experience_years > 0 || (photographer.languages && photographer.languages.length > 0 && photographer.languages[0] !== "") || photographer.session_count > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {photographer.experience_years > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {tc("yrsExperience", { years: photographer.experience_years })}
                    </span>
                  )}
                  {photographer.languages && photographer.languages.length > 0 && photographer.languages[0] !== "" && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      {photographer.languages.join(", ")}
                    </span>
                  )}
                  {photographer.session_count > 0 && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      {tc("sessions", { count: photographer.session_count })}
                    </span>
                  )}
                </div>
              )}

              {/* Specialties */}
              {photographer.shoot_types && photographer.shoot_types.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {photographer.shoot_types.map((type: string) => (
                    <span key={type} className="rounded-full border border-primary-200 px-2.5 py-1.5 text-xs font-medium text-primary-600">
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Message — top right on desktop */}
            {result.type === "db" && (
              <div id="message" className="shrink-0 sm:ml-auto sm:self-center">
                <AskQuestionButton photographerId={photographer.id} photographerName={normalizeName(photographer.name)} autoOpen={typeof window !== "undefined" && window.location.hash === "#message"} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-8 grid grid-cols-1 gap-12 pb-16 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-12">
            {/* About */}
            {photographer.bio && (
              <section>
                <h2 className="text-xl font-bold text-gray-900">{t("about")}</h2>
                <p className="mt-3 text-gray-600 leading-relaxed">{photographer.bio}</p>
              </section>
            )}

            {/* Portfolio */}
            {portfolioItems.length > 0 && (
              <PortfolioGallery
                items={portfolioItems}
                locations={allLocations.map((l) => ({ slug: l.slug, name: l.name }))}
                photographerName={normalizeName(photographer.name)}
              />
            )}

            {/* Reviews */}
            <div id="reviews" className="scroll-mt-24" />
            <ReviewsPaginated
              reviews={reviews}
              reviewCount={photographer.review_count}
              rating={photographer.rating}
              photographerName={normalizeName(photographer.name)}
              photographerSlug={slug}
            />
          </div>

          {/* Sidebar — packages */}
          <div className="lg:col-span-1 order-first lg:order-none">
            <div className="sticky top-24 space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
              {photographer.packages && photographer.packages.length > 0 && (
                <>
                  <h2 className="text-xl font-bold text-gray-900">{t("packages")}</h2>
                  {photographer.packages.map((pkg: { id: string; name: string; description: string | null; price: number; duration_minutes: number; num_photos: number; is_popular: boolean; delivery_days?: number }) => (
                    <PackageCard key={pkg.id} pkg={pkg} photographerSlug={photographer.slug} />
                  ))}
                </>
              )}

              {/* Contact card for profiles without packages */}
              {(!photographer.packages || photographer.packages.length === 0) && (
                <div className="rounded-xl border border-warm-200 bg-white p-6">
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
                <Link
                  key={sp.id}
                  href={`/photographers/${sp.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-warm-200 bg-white transition hover:border-primary-200 hover:shadow-md"
                >
                  {/* Cover */}
                  <div className="relative h-36 bg-warm-100">
                    {sp.cover_url ? (
                      <OptimizedImage src={sp.cover_url} alt={normalizeName(sp.name)} width={400} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-warm-100 to-warm-200" />
                    )}
                    {/* Avatar overlay */}
                    <div className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-sm font-bold text-primary-600 overflow-hidden shadow-sm">
                      {sp.avatar_url ? (
                        <OptimizedImage src={sp.avatar_url} alt={normalizeName(sp.name)} width={80} className="h-full w-full object-cover" />
                      ) : (
                        normalizeName(sp.name).charAt(0)
                      )}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-7">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
                      {normalizeName(sp.name)}
                    </h3>
                    {sp.tagline && (
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{sp.tagline}</p>
                    )}
                    {/* Rating */}
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <span className="text-amber-500">
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </span>
                      <span className="font-semibold text-gray-900">{sp.review_count > 0 ? Number(sp.rating).toFixed(1) : "New"}</span>
                      {sp.review_count > 0 && <span className="text-gray-400">({sp.review_count})</span>}
                    </div>
                    {/* Locations */}
                    {sp.location_names.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sp.location_names.map((loc) => (
                          <span key={loc} className="rounded-full bg-warm-100 px-2 py-0.5 text-[10px] text-gray-500 capitalize">{loc.replace(/-/g, " ")}</span>
                        ))}
                      </div>
                    )}
                    {/* Price — pinned to bottom */}
                    {sp.starting_price && (
                      <p className="mt-auto pt-3 text-sm">
                        <span className="text-gray-400">{t("from")}</span>{" "}
                        <span className="font-bold text-gray-900">&euro;{Math.round(Number(sp.starting_price))}</span>
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
