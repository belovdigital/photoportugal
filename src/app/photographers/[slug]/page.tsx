import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  demoPhotographers,
  getPhotographerBySlug,
  getReviewsForPhotographer,
} from "@/lib/demo-data";

export function generateStaticParams() {
  return demoPhotographers.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const photographer = getPhotographerBySlug(slug);
  if (!photographer) return {};

  const locationNames = photographer.locations.map((l) => l.name).join(", ");
  return {
    title: `${photographer.display_name} — Photographer in ${locationNames}, Portugal`,
    description: `Book ${photographer.display_name}, a professional photographer in ${locationNames}, Portugal. ${photographer.tagline}. ${photographer.review_count} verified reviews, ${photographer.rating} rating.`,
  };
}

export default async function PhotographerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const photographer = getPhotographerBySlug(slug);

  if (!photographer) {
    notFound();
  }

  const reviews = getReviewsForPhotographer(photographer.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: photographer.display_name,
    description: photographer.bio,
    image: photographer.avatar_url,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: photographer.rating,
      reviewCount: photographer.review_count,
    },
    priceRange: `€${photographer.packages[0]?.price ?? photographer.hourly_rate}+`,
    address: {
      "@type": "PostalAddress",
      addressLocality: photographer.locations[0]?.name,
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
      <div className="h-64 bg-gradient-to-br from-primary-400 to-primary-700 sm:h-80" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            {/* Avatar */}
            <div className="flex h-32 w-32 items-center justify-center rounded-2xl border-4 border-white bg-primary-100 text-4xl font-bold text-primary-600 shadow-lg sm:h-40 sm:w-40">
              {photographer.display_name.charAt(0)}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
                  {photographer.display_name}
                </h1>
                {photographer.is_verified && (
                  <span className="text-accent-500" title="Verified Photographer">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
                {photographer.is_featured && (
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                    Featured
                  </span>
                )}
              </div>
              <p className="mt-1 text-lg text-gray-500">{photographer.tagline}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-12 pb-16 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-12">
            {/* About */}
            <section>
              <h2 className="text-xl font-bold text-gray-900">About</h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                {photographer.bio}
              </p>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-gray-400">Experience</span>
                  <p className="font-semibold text-gray-900">
                    {photographer.experience_years} years
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Languages</span>
                  <p className="font-semibold text-gray-900">
                    {photographer.languages.join(", ")}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Sessions completed</span>
                  <p className="font-semibold text-gray-900">
                    {photographer.session_count}+
                  </p>
                </div>
              </div>
            </section>

            {/* Locations */}
            <section>
              <h2 className="text-xl font-bold text-gray-900">Locations</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {photographer.locations.map((loc) => (
                  <Link
                    key={loc.slug}
                    href={`/locations/${loc.slug}`}
                    className="rounded-full bg-warm-100 px-4 py-2 text-sm font-medium text-warm-700 transition hover:bg-warm-200"
                  >
                    {loc.name}
                  </Link>
                ))}
              </div>
            </section>

            {/* Portfolio placeholder */}
            <section>
              <h2 className="text-xl font-bold text-gray-900">Portfolio</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-gradient-to-br from-warm-200 to-warm-300"
                  />
                ))}
              </div>
            </section>

            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Reviews ({photographer.review_count})
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {photographer.rating}
                  </span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className={`h-5 w-5 ${i < Math.round(photographer.rating) ? "text-yellow-400" : "text-gray-200"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-6">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-warm-200 bg-white p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
                          {review.client_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {review.client_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(review.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      {review.is_verified && (
                        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-700">
                          Verified Booking
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <svg
                          key={i}
                          className="h-4 w-4 text-yellow-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <h4 className="mt-2 font-semibold text-gray-900">
                      {review.title}
                    </h4>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                      {review.text}
                    </p>
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
              <h2 className="text-xl font-bold text-gray-900">Packages</h2>
              {photographer.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-xl border p-6 ${
                    pkg.is_popular
                      ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
                      : "border-warm-200 bg-white"
                  }`}
                >
                  {pkg.is_popular && (
                    <span className="mb-3 inline-block rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">
                    {pkg.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {pkg.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      &euro;{pkg.price}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-accent-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {pkg.duration_minutes} minutes
                    </li>
                    <li className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-accent-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {pkg.num_photos} edited photos
                    </li>
                    <li className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-accent-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Online gallery
                    </li>
                  </ul>
                  <button className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
                    Book This Package
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
