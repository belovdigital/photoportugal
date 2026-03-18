import type { Metadata } from "next";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: `${locations.length} Best Photoshoot Locations in Portugal — Lisbon, Porto, Algarve & More`,
  description:
    `Discover ${locations.length}+ stunning photoshoot locations across Portugal. From Lisbon's colorful streets to Algarve's golden cliffs. Browse verified photographers in every destination.`,
  alternates: { canonical: "https://photoportugal.com/locations" },
};

export default function LocationsPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: locations.length,
    itemListElement: locations.map((loc, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://photoportugal.com/locations/${loc.slug}`,
      name: loc.name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Locations", href: "/locations" },
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            Best Photoshoot Locations in Portugal
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            From Lisbon&apos;s cobblestone streets to the Algarve&apos;s golden cliffs — explore {locations.length}+ stunning destinations for your
            vacation photoshoot and find the perfect setting for your memories.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <LocationCard key={location.slug} location={location} />
          ))}
        </div>
      </div>
    </>
  );
}
