import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { PhotographerDashboardClient } from "./PhotographerDashboardClient";

export default async function PhotographerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;

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
    plan: string;
    rating: number;
    review_count: number;
    session_count: number;
  }>(
    "SELECT id, slug, display_name, tagline, bio, avatar_url, cover_url, languages, shoot_types, hourly_rate, experience_years, plan, rating, review_count, session_count FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">No photographer profile found</h1>
        <p className="mt-2 text-gray-500">Please contact support if you believe this is an error.</p>
      </div>
    );
  }

  // Get photographer's locations
  const locationRows = await query<{ location_slug: string }>(
    "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
    [profile.id]
  );
  const locationSlugs = locationRows.map((r) => r.location_slug);

  const portfolioItems = await query<{
    id: string;
    type: string;
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
    sort_order: number;
  }>(
    "SELECT id, type, url, thumbnail_url, caption, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order",
    [profile.id]
  );

  const packages = await query<{
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

  const allLocations = locations.map((l) => ({
    slug: l.slug,
    name: l.name,
    region: l.region,
  }));

  return (
    <PhotographerDashboardClient
      profile={{ ...profile, location_slugs: locationSlugs }}
      portfolioItems={portfolioItems}
      packages={packages}
      allLocations={allLocations}
    />
  );
}
