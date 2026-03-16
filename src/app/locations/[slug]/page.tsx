import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locations, getLocationBySlug } from "@/lib/locations-data";
import { locationImage } from "@/lib/unsplash-images";

export function generateStaticParams() {
  return locations.map((loc) => ({ slug: loc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = getLocationBySlug(slug);
  if (!location) return {};

  return {
    title: location.seo_title,
    description: location.seo_description,
    alternates: { canonical: `https://photoportugal.com/locations/${slug}` },
    openGraph: {
      title: location.seo_title,
      description: location.seo_description,
      type: "website",
      url: `https://photoportugal.com/locations/${slug}`,
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = getLocationBySlug(slug);

  if (!location) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: `${location.name}, Portugal`,
    description: location.description,
    geo: {
      "@type": "GeoCoordinates",
      latitude: location.lat,
      longitude: location.lng,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={locationImage(location.slug, "hero")}
            alt={`${location.name}, Portugal`}
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950/85 via-primary-900/70 to-primary-800/50" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary-300">
              {location.region}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Photographers in {location.name}
            </h1>
            <p className="mt-6 text-lg text-primary-100/90">
              {location.description}
            </p>
            <div className="mt-8">
              <Link
                href={`/photographers?location=${location.slug}`}
                className="inline-flex rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50 hover:shadow-xl"
              >
                View Photographers in {location.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About the location */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              Why {location.name} for Your Photoshoot
            </h2>
            <div className="mt-6 text-gray-600 leading-relaxed space-y-4">
              <p>{location.long_description}</p>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold text-gray-900">
                Popular photoshoot types in {location.name}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Couples",
                  "Family",
                  "Solo Portrait",
                  "Engagement",
                  "Proposal",
                  "Honeymoon",
                  "Friends Trip",
                  "Anniversary",
                ].map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">Quick Facts</h3>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">Region</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {location.region}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Best Time for Photos</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    Golden hour (sunrise & sunset)
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Average Session</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    1-2 hours
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Starting From</dt>
                  <dd className="text-sm font-semibold text-primary-600">
                    &euro;150 / session
                  </dd>
                </div>
              </dl>
              <Link
                href={`/photographers?location=${location.slug}`}
                className="mt-6 block w-full rounded-xl bg-primary-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                Find Photographers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={locationImage(location.slug, "card")}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            Ready for Your {location.name} Photoshoot?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            Browse our verified photographers, check their portfolios, and book
            your session in minutes.
          </p>
          <Link
            href={`/photographers?location=${location.slug}`}
            className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
          >
            Browse {location.name} Photographers
          </Link>
        </div>
      </section>
    </>
  );
}
