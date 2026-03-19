import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";
import { PortfolioGallery } from "@/components/photographers/PortfolioGallery";
import { AskQuestionButton } from "@/components/ui/AskQuestionButton";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ReviewsPaginated } from "@/components/ui/ReviewsPaginated";

export const dynamicParams = true;
export const revalidate = 60;

async function getPhotographer(slug: string) {
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
      hourly_rate: number | null;
      experience_years: number;
      is_verified: boolean;
      is_featured: boolean;
      is_approved: boolean;
      plan: string;
      rating: number;
      review_count: number;
      session_count: number;
      last_seen_at: string | null;
    }>(
      `SELECT p.id, p.slug, p.display_name, p.tagline, p.bio, u.avatar_url, p.cover_url, p.cover_position_y, p.languages, p.shoot_types,
              p.hourly_rate, p.experience_years, p.is_verified, p.is_featured, p.is_approved, p.plan,
              p.rating, p.review_count, p.session_count, u.last_seen_at
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1`,
      [slug]
    );
    if (!profile || !profile.is_approved) return null;

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

    const portfolioItems = await query<{ url: string; caption: string | null; location_slug: string | null; shoot_type: string | null }>(
      "SELECT url, caption, location_slug, shoot_type FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order",
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPhotographer(slug);
  if (!result) return {};

  const p = result.data;
  const locationNames = (p.locations || []).map((l: { name: string }) => l.name).join(", ");
  const title = `${p.display_name} — Photographer in ${locationNames || "Portugal"}`;
  const description = `Book ${p.display_name}, a professional photographer in ${locationNames || "Portugal"}. ${p.tagline || ""}`;
  const ogImage = p.cover_url || p.avatar_url || "/og-image.png";
  return {
    title,
    description,
    alternates: { canonical: `https://photoportugal.com/photographers/${slug}` },
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPhotographer(slug);

  if (!result) {
    notFound();
  }

  const photographer = result.data;
  let reviews: { id: string; rating: number; title: string | null; text: string | null; is_verified: boolean; created_at: string; client_name: string; client_avatar: string | null }[] = [];
  const portfolioItems = (photographer as { portfolioItems?: { url: string; caption: string | null; location_slug: string | null; shoot_type: string | null }[] }).portfolioItems || [];

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
      }>(
        `SELECT r.id, r.rating, r.title, r.text, r.is_verified, r.created_at,
                u.name as client_name, u.avatar_url as client_avatar
         FROM reviews r
         JOIN users u ON u.id = r.client_id
         WHERE r.photographer_id = $1
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
        photos: [],
        photos_public: false,
        is_verified: r.is_verified,
        created_at: r.created_at,
      }));
    } catch {}
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: photographer.display_name,
    description: photographer.bio || photographer.tagline,
    url: `https://photoportugal.com/photographers/${slug}`,
    image: photographer.cover_url || photographer.avatar_url || undefined,
    priceRange: photographer.hourly_rate ? `From €${photographer.hourly_rate}` : undefined,
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
      description: pkg.description || `${pkg.name} photography package by ${photographer.display_name}`,
      offers: {
        "@type": "Offer",
        price: String(pkg.price),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `https://photoportugal.com/photographers/${slug}`,
      },
    })
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {productJsonLd.map((product: Record<string, unknown>, idx: number) => (
        <script
          key={`product-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
        />
      ))}

      {/* Cover */}
      <div className="h-64 bg-gradient-to-br from-primary-400 to-primary-700 sm:h-80 lg:h-96 overflow-hidden">
        {photographer.cover_url && (
          <OptimizedImage src={photographer.cover_url} alt={`${photographer.display_name} — photography portfolio cover`} width={2000} quality={90} priority className="h-full w-full" style={{ objectPosition: `center ${photographer.cover_position_y ?? 50}%` }} />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-32 w-32 items-center justify-center rounded-full ring-[5px] ring-white bg-primary-100 text-4xl font-bold text-primary-600 sm:h-40 sm:w-40 overflow-hidden">
                {photographer.avatar_url ? (
                  <OptimizedImage src={photographer.avatar_url} alt={photographer.display_name} width={400} priority className="h-full w-full" />
                ) : (
                  photographer.display_name.charAt(0)
                )}
              </div>
              {result.type === "db" && (photographer as { last_seen_at?: string }).last_seen_at && (Date.now() - new Date((photographer as { last_seen_at: string }).last_seen_at).getTime()) < 5 * 60 * 1000 && (
                <span className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex h-4 w-4 rounded-full ring-[3px] ring-white bg-green-500" title="Online" />
              )}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                  {photographer.display_name}
                </h1>
                {photographer.is_verified && (
                  <span className="text-accent-500" title="Verified Photographer">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
                {photographer.is_featured && (
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">Featured</span>
                )}
              </div>
              {photographer.tagline && (
                <p className="mt-1 text-lg text-gray-500">{photographer.tagline}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-12 pb-16 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-12">
            {/* About */}
            {photographer.bio && (
              <section>
                <h2 className="text-xl font-bold text-gray-900">About</h2>
                <p className="mt-4 text-gray-600 leading-relaxed">{photographer.bio}</p>
                <div className="mt-6 flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-gray-400">Experience</span>
                    <p className="font-semibold text-gray-900">{photographer.experience_years} years</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Languages</span>
                    <p className="font-semibold text-gray-900">{photographer.languages.join(", ") || "—"}</p>
                  </div>
                  {photographer.session_count > 0 && (
                    <div>
                      <span className="text-gray-400">Sessions completed</span>
                      <p className="font-semibold text-gray-900">{photographer.session_count}+</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Shoot Types */}
            {photographer.shoot_types && photographer.shoot_types.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900">Specialties</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {photographer.shoot_types.map((type: string) => (
                    <span key={type} className="rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
                      {type}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Locations */}
            {photographer.locations && photographer.locations.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900">Locations</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {photographer.locations.map((loc: { slug: string; name: string }) => (
                    <Link key={loc.slug} href={`/locations/${loc.slug}`} className="rounded-full bg-warm-100 px-4 py-2 text-sm font-medium text-warm-700 transition hover:bg-warm-200">
                      {loc.name}
                    </Link>
                  ))}
                </div>
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
                  <h2 className="text-xl font-bold text-gray-900">Packages</h2>
                  {photographer.packages.map((pkg: { id: string; name: string; description: string | null; price: number; duration_minutes: number; num_photos: number; is_popular: boolean; delivery_days?: number }) => (
                    <div
                      key={pkg.id}
                      className={`rounded-xl border p-6 ${
                        pkg.is_popular
                          ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
                          : "border-warm-200 bg-white"
                      }`}
                    >
                      {pkg.is_popular && (
                        <span className="mb-3 inline-block rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">Most Popular</span>
                      )}
                      <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                      {pkg.description && <p className="mt-1 text-sm text-gray-500">{pkg.description}</p>}
                      <div className="mt-4">
                        <span className="text-3xl font-bold text-gray-900">&euro;{pkg.price}</span>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-gray-600">
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {pkg.duration_minutes} minutes
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {pkg.num_photos} edited photos
                        </li>
                        <li className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {pkg.delivery_days || 7}-day delivery
                        </li>
                      </ul>
                      <Link href={`/book/${photographer.slug}`} className="mt-6 block w-full rounded-xl bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700">
                        Book This Package
                      </Link>
                    </div>
                  ))}
                </>
              )}

              {/* Contact card for profiles without packages */}
              {(!photographer.packages || photographer.packages.length === 0) && (
                <div className="rounded-xl border border-warm-200 bg-white p-6">
                  <h2 className="text-lg font-bold text-gray-900">Interested?</h2>
                  {photographer.hourly_rate ? (
                    <>
                      <p className="mt-2 text-sm text-gray-500">
                        Send a message to discuss availability and book your session.
                      </p>
                      <p className="mt-4 text-sm text-gray-600">
                        Starting from <span className="text-xl font-bold text-gray-900">&euro;{Number(photographer.hourly_rate).toFixed(0)}</span>/hour
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">
                      Send a message to discuss packages, pricing, and availability.
                    </p>
                  )}
                </div>
              )}

              {/* Message button — always visible for DB photographers */}
              {result.type === "db" && (
                <AskQuestionButton photographerId={photographer.id} photographerName={photographer.display_name} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
