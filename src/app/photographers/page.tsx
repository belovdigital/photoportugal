import type { Metadata } from "next";
import { locations, regions } from "@/lib/locations-data";
import { demoPhotographers } from "@/lib/demo-data";
import { SHOOT_TYPES } from "@/types";
import { PhotographerCatalog } from "./PhotographerCatalog";

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
  const { location: initialLocation } = await searchParams;

  return (
    <PhotographerCatalog
      photographers={demoPhotographers}
      locations={locations}
      regions={regions}
      shootTypes={SHOOT_TYPES as unknown as string[]}
      initialLocation={initialLocation}
    />
  );
}
