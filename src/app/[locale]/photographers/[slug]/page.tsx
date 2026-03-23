import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";
import { PortfolioGallery } from "@/components/photographers/PortfolioGallery";
import { AskQuestionButton } from "@/components/ui/AskQuestionButton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ReviewsPaginated } from "@/components/ui/ReviewsPaginated";
import { PackageCard } from "@/components/ui/PackageCard";
import { localeAlternates } from "@/lib/seo";

export const dynamicParams = true;
export const dynamic = "force-dynamic";

async function getPhotographer(slug: string, isAdmin = false) {
  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      display_name: string;
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
      `SELECT p.id, p.slug, p.display_name, p.tagline, p.bio, u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
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
      "SELECT id, name, description, duration_minutes, num_photos, price, is_popular, COALESCE(delivery_days, 7) as delivery_days FROM packages WHERE photographer_id = $1 ORDER BY price",
      [profile.id]
    );

    const portfolioItems = await query<{ url: string; thumbnail_url: string | null; caption: string | null; location_slug: string | null; shoot_type: string | null }>(
      "SELECT url, thumbnail_url, caption, location_slug, shoot_type FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at ASC",
      [profile.id]
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
  const title = t("metaTitle", { name: p.display_name, locations: locationNames || "Portugal" });
  const description = `${t("metaDescription", { name: p.display_name, locations: locationNames || "Portugal" })} ${p.tagline || ""}`.trim();
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

  const isPreview = sp.preview === process.env.ADMIN_PREVIEW_SECRET;
  const result = await getPhotographer(slug, isPreview);

  if (!result) {
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
  let similarPhotographers: { id: string; slug: string; display_name: string; avatar_url: string | null; tagline: string | null; rating: number; review_count: number }[] = [];
  const primaryLocation = photographer.locations?.[0];
  if (result.type === "db") {
    try {
      similarPhotographers = await query<{
        id: string;
        slug: string;
        display_name: string;
        avatar_url: string | null;
        tagline: string | null;
        rating: number;
        review_count: number;
      }>(
        `SELECT DISTINCT pp.id, pp.slug, pp.display_name, u.avatar_url, pp.tagline, pp.rating, pp.review_count
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
    name: photographer.display_name,
    description: photographer.bio || photographer.tagline,
    url: `https://photoportugal.com/photographers/${slug}`,
    image: photographer.cover_url || photographer.avatar_url || undefined,
    priceRange: photographer.packages?.length > 0 ? `From €${Math.min(...photographer.packages.map((pkg: { price: number }) => pkg.price))}` : undefined,
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
      description: pkg.description || t("packageDescription", { packageName: pkg.name, name: photographer.display_name }),
      offers: {
        "@type": "Offer",
        price: String(pkg.price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `https://photoportugal.com/photographers/${slug}`,
      },
    })
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tc("home"), item: "https://photoportugal.com" },
      { "@type": "ListItem", position: 2, name: tc("photographers"), item: "https://photoportugal.com/photographers" },
      { "@type": "ListItem", position: 3, name: photographer.display_name, item: `https://photoportugal.com/photographers/${slug}` },
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
                  <OptimizedImage src={photographer.avatar_url} alt={photographer.display_name} width={400} priority className="h-full w-full" />
                ) : (
                  photographer.display_name.charAt(0)
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
                  {photographer.display_name}
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
                {photographer.review_count === 0 && (
                  <span className="text-xs text-gray-400">{t("newPhotographer")}</span>
                )}
              </div>

              {/* Compact meta: locations, specialties, experience, languages */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                {/* Locations */}
                {photographer.locations && photographer.locations.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {photographer.locations.map((loc: { slug: string; name: string }) => (
                      <span key={loc.slug} className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <Link href={`/locations/${loc.slug}`} className="hover:text-primary-600 transition">{loc.name}</Link>
                      </span>
                    ))}
                  </span>
                )}
                {photographer.experience_years > 0 && (
                  <>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {tc("yrsExperience", { years: photographer.experience_years })}
                    </span>
                  </>
                )}
                {photographer.languages && photographer.languages.length > 0 && photographer.languages[0] !== "" && (
                  <>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      {photographer.languages.join(", ")}
                    </span>
                  </>
                )}
                {photographer.session_count > 0 && (
                  <>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span>{tc("sessions", { count: photographer.session_count })}</span>
                  </>
                )}
              </div>

              {/* Specialties as small tags */}
              {photographer.shoot_types && photographer.shoot_types.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {photographer.shoot_types.map((type: string) => (
                    <span key={type} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Message — top right on desktop */}
            {result.type === "db" && (
              <div id="message" className="shrink-0 sm:ml-auto sm:self-center">
                <AskQuestionButton photographerId={photographer.id} photographerName={photographer.display_name} autoOpen={typeof window !== "undefined" && window.location.hash === "#message"} />
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
              />
            )}

            {/* Reviews */}
            <div id="reviews" className="scroll-mt-24" />
            <ReviewsPaginated
              reviews={reviews}
              reviewCount={photographer.review_count}
              rating={photographer.rating}
              photographerName={photographer.display_name}
              photographerSlug={slug}
            />
          </div>

          {/* Sidebar — packages */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
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
                  className="group flex items-start gap-4 rounded-xl border border-warm-200 bg-white p-5 transition hover:border-primary-200 hover:shadow-md"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600 overflow-hidden">
                    {sp.avatar_url ? (
                      <OptimizedImage src={sp.avatar_url} alt={sp.display_name} width={200} className="h-full w-full" />
                    ) : (
                      sp.display_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition truncate">
                      {sp.display_name}
                    </h3>
                    {sp.tagline && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-1">{sp.tagline}</p>
                    )}
                    {sp.review_count > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-sm">
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </span>
                        <span className="font-semibold text-gray-900">{Number(sp.rating).toFixed(1)}</span>
                        <span className="text-gray-400">({sp.review_count})</span>
                      </div>
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
