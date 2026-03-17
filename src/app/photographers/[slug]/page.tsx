import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  demoPhotographers,
  getPhotographerBySlug,
  getReviewsForPhotographer,
} from "@/lib/demo-data";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";
import { AskQuestionButton } from "@/components/ui/AskQuestionButton";

// Keep demo params for SSG, but allow dynamic slugs too
export function generateStaticParams() {
  return demoPhotographers.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = true;
export const revalidate = 60; // Revalidate every 60 seconds

async function getPhotographer(slug: string) {
  // Try demo data first
  const demo = getPhotographerBySlug(slug);
  if (demo) return { type: "demo" as const, data: demo };

  // Try DB
  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      display_name: string;
      tagline: string | null;
      bio: string | null;
      avatar_url: string | null;
      cover_url: string | null;
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
      `SELECT p.id, p.slug, p.display_name, p.tagline, p.bio, u.avatar_url, p.cover_url, p.languages, p.shoot_types,
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
    }>(
      "SELECT id, name, description, duration_minutes, num_photos, price, is_popular FROM packages WHERE photographer_id = $1 ORDER BY price",
      [profile.id]
    );

    const portfolioItems = await query<{ url: string; caption: string | null }>(
      "SELECT url, caption FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order LIMIT 12",
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
  return {
    title,
    description,
    alternates: { canonical: `https://photoportugal.com/photographers/${slug}` },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `https://photoportugal.com/photographers/${slug}`,
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
  let reviews = result.type === "demo" ? getReviewsForPhotographer(photographer.id) : [];
  const portfolioItems = result.type === "db" ? (photographer as { portfolioItems: { url: string; caption: string | null }[] }).portfolioItems : [];

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
    description: photographer.bio,
    aggregateRating: photographer.review_count > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: photographer.rating,
          reviewCount: photographer.review_count,
        }
      : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: photographer.locations?.[0]?.name,
      addressCountry: "PT",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cover */}
      <div className="h-64 bg-gradient-to-br from-primary-400 to-primary-700 sm:h-80 overflow-hidden">
        {photographer.cover_url && (
          <img src={photographer.cover_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-white bg-primary-100 text-4xl font-bold text-primary-600 shadow-lg sm:h-40 sm:w-40 overflow-hidden">
                {photographer.avatar_url ? (
                  <img src={photographer.avatar_url} alt={photographer.display_name} className="h-full w-full object-cover" />
                ) : (
                  photographer.display_name.charAt(0)
                )}
              </div>
              {result.type === "db" && (photographer as { last_seen_at?: string }).last_seen_at && (Date.now() - new Date((photographer as { last_seen_at: string }).last_seen_at).getTime()) < 5 * 60 * 1000 && (
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-green-500" title="Online" />
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
              <section>
                <h2 className="text-xl font-bold text-gray-900">Portfolio</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {portfolioItems.map((item: { url: string; caption: string | null }, i: number) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-xl bg-warm-100">
                      <img src={item.url} alt={item.caption || "Portfolio photo"} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Reviews ({photographer.review_count})
                </h2>
                {photographer.rating > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{photographer.rating}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`h-5 w-5 ${i < Math.round(photographer.rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-warm-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                          {review.client_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{review.client_name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      {review.is_verified && (
                        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">Verified Booking</span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <h4 className="mt-2 font-semibold text-gray-900">{review.title}</h4>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{review.text}</p>
                  </div>
                ))}
                {reviews.length === 0 && (
                  <p className="text-gray-400">No reviews yet.</p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar — packages */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {photographer.packages && photographer.packages.length > 0 && (
                <>
                  <h2 className="text-xl font-bold text-gray-900">Packages</h2>
                  {photographer.packages.map((pkg: { id: string; name: string; description: string | null; price: number; duration_minutes: number; num_photos: number; is_popular: boolean }) => (
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
                  <p className="mt-2 text-sm text-gray-500">This photographer hasn&apos;t set up packages yet. Check back soon!</p>
                  {photographer.hourly_rate && (
                    <p className="mt-4 text-sm text-gray-600">
                      Starting from <span className="text-xl font-bold text-gray-900">&euro;{photographer.hourly_rate}</span>/hour
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
