import type { Metadata } from "next";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";

export const metadata: Metadata = {
  title: "Photography Locations in Portugal",
  description:
    "Explore 23+ stunning photography locations across Portugal — from Lisbon and Porto to the Algarve coast, Azores islands, and hidden gems. Find your perfect photoshoot spot.",
  alternates: { canonical: "https://photoportugal.com/locations" },
};

export default function LocationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
          Photography Locations
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Portugal offers an incredible variety of breathtaking backdrops for
          your photoshoot. Explore our top destinations and find the perfect
          setting for your memories.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <LocationCard key={location.slug} location={location} />
        ))}
      </div>
    </div>
  );
}
