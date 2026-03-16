import type { Metadata } from "next";
import Link from "next/link";
import { locations } from "@/lib/locations-data";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { demoPhotographers } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Find Photographers in Portugal",
  description:
    "Browse professional photographers across Portugal. View portfolios, read verified reviews, and book your perfect vacation photoshoot.",
};

export default async function PhotographersPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location: locationFilter } = await searchParams;
  const photographers = demoPhotographers.filter(
    (p) => !locationFilter || p.locations.some((l) => l.slug === locationFilter)
  );

  const activeLocation = locationFilter
    ? locations.find((l) => l.slug === locationFilter)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
          {activeLocation
            ? `Photographers in ${activeLocation.name}`
            : "Find Your Photographer"}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {activeLocation
            ? `Browse verified photographers available for photoshoots in ${activeLocation.name}, Portugal.`
            : "Browse our community of talented photographers across Portugal. Filter by location, style, and budget."}
        </p>
      </div>

      {/* Location filter pills */}
      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/photographers"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !locationFilter
              ? "bg-primary-600 text-white"
              : "bg-warm-100 text-gray-700 hover:bg-warm-200"
          }`}
        >
          All Locations
        </Link>
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            href={`/photographers?location=${loc.slug}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              locationFilter === loc.slug
                ? "bg-primary-600 text-white"
                : "bg-warm-100 text-gray-700 hover:bg-warm-200"
            }`}
          >
            {loc.name}
          </Link>
        ))}
      </div>

      {/* Photographer grid */}
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {photographers.map((photographer) => (
          <PhotographerCard
            key={photographer.id}
            photographer={photographer}
          />
        ))}
      </div>

      {photographers.length === 0 && (
        <div className="mt-16 text-center">
          <p className="text-lg text-gray-500">
            No photographers found for this location yet. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}
