import type { Metadata } from "next";
import { locations, regions } from "@/lib/locations-data";
import { SHOOT_TYPES, PhotographerProfile } from "@/types";
import { PhotographerCatalog } from "./PhotographerCatalog";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Find Photographers in Portugal",
  description:
    "Browse professional photographers across Portugal. View portfolios, read verified reviews, and book your perfect vacation photoshoot.",
};

async function getDbPhotographers(): Promise<PhotographerProfile[]> {
  try {
    const profiles = await query<{
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
      plan: string;
      rating: number;
      review_count: number;
      session_count: number;
    }>(
      `SELECT p.id, p.slug, p.display_name, p.tagline, p.bio,
              u.avatar_url, p.cover_url, p.languages, p.shoot_types,
              p.hourly_rate, p.experience_years, p.is_verified, p.is_featured,
              p.plan, p.rating, p.review_count, p.session_count
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_approved = TRUE
       ORDER BY p.is_featured DESC, p.rating DESC`
    );

    if (profiles.length === 0) return [];

    // Get locations for all photographers
    const allLocRows = await query<{ photographer_id: string; location_slug: string }>(
      "SELECT photographer_id, location_slug FROM photographer_locations"
    );

    // Get packages for all photographers
    const allPkgs = await query<{
      id: string;
      photographer_id: string;
      name: string;
      description: string | null;
      duration_minutes: number;
      num_photos: number;
      price: number;
      is_popular: boolean;
    }>(
      "SELECT id, photographer_id, name, description, duration_minutes, num_photos, price, is_popular FROM packages ORDER BY price"
    );

    return profiles.map((p) => {
      const locSlugs = allLocRows
        .filter((r) => r.photographer_id === p.id)
        .map((r) => r.location_slug);
      const locs = locSlugs
        .map((s) => locations.find((l) => l.slug === s))
        .filter((l): l is (typeof locations)[number] => l !== undefined);
      const pkgs = allPkgs
        .filter((pkg) => pkg.photographer_id === p.id)
        .map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description || "",
          duration_minutes: pkg.duration_minutes,
          num_photos: pkg.num_photos,
          price: pkg.price,
          is_popular: pkg.is_popular,
        }));

      return {
        id: p.id,
        user_id: "",
        slug: p.slug,
        display_name: p.display_name,
        tagline: p.tagline || "",
        bio: p.bio || "",
        avatar_url: p.avatar_url,
        cover_url: p.cover_url,
        languages: p.languages || [],
        hourly_rate: p.hourly_rate ? Number(p.hourly_rate) : 0,
        currency: "EUR",
        locations: locs,
        packages: pkgs,
        shoot_types: p.shoot_types || [],
        experience_years: p.experience_years,
        is_verified: p.is_verified,
        is_featured: p.is_featured,
        plan: p.plan,
        rating: Number(p.rating),
        review_count: p.review_count,
        session_count: p.session_count,
        created_at: "",
      } as PhotographerProfile;
    });
  } catch (error) {
    console.error("[photographers] DB error:", error);
    return [];
  }
}

export default async function PhotographersPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; shoot?: string }>;
}) {
  const { location: initialLocation, shoot: initialShootType } = await searchParams;
  const dbPhotographers = await getDbPhotographers();

  return (
    <PhotographerCatalog
      photographers={dbPhotographers}
      locations={locations}
      regions={regions}
      shootTypes={SHOOT_TYPES as unknown as string[]}
      initialLocation={initialLocation}
      initialShootType={initialShootType}
    />
  );
}
