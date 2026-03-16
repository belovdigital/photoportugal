import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
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
    hourly_rate: number | null;
    experience_years: number;
    plan: string;
    rating: number;
    review_count: number;
    session_count: number;
  }>(
    "SELECT id, slug, display_name, tagline, bio, avatar_url, cover_url, languages, hourly_rate, experience_years, plan, rating, review_count, session_count FROM photographer_profiles WHERE user_id = $1",
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

  const portfolioItems = await query<{
    id: string;
    type: string;
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
    order: number;
  }>(
    "SELECT id, type, url, thumbnail_url, caption, \"order\" FROM portfolio_items WHERE photographer_id = $1 ORDER BY \"order\"",
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

  return (
    <PhotographerDashboardClient
      profile={profile}
      portfolioItems={portfolioItems}
      packages={packages}
    />
  );
}
