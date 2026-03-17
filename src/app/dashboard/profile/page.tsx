import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { PhotographerDashboardClient } from "../photographer/PhotographerDashboardClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{
    id: string; slug: string; display_name: string; tagline: string | null;
    bio: string | null; avatar_url: string | null; cover_url: string | null;
    languages: string[]; shoot_types: string[]; hourly_rate: number | null;
    experience_years: number; plan: string; rating: number; review_count: number; session_count: number; is_approved: boolean;
  }>(
    `SELECT pp.id, pp.slug, pp.display_name, pp.tagline, pp.bio, u.avatar_url, pp.cover_url,
            pp.languages, pp.shoot_types, pp.hourly_rate, pp.experience_years, pp.plan,
            pp.rating, pp.review_count, pp.session_count, pp.is_approved
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.user_id = $1`,
    [userId]
  );

  if (!profile) redirect("/dashboard");

  const locationRows = await query<{ location_slug: string }>(
    "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
    [profile.id]
  );

  const portfolioItems = await query<{
    id: string; type: string; url: string; thumbnail_url: string | null; caption: string | null; sort_order: number;
  }>("SELECT id, type, url, thumbnail_url, caption, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order", [profile.id]);

  const packages = await query<{
    id: string; name: string; description: string | null; duration_minutes: number; num_photos: number; price: number; is_popular: boolean;
  }>("SELECT id, name, description, duration_minutes, num_photos, price, is_popular FROM packages WHERE photographer_id = $1 ORDER BY price", [profile.id]);

  const bookings = await query<{
    id: string; client_name: string; client_email: string; client_avatar: string | null;
    package_name: string | null; duration_minutes: number | null; num_photos: number | null;
    status: string; shoot_date: string | null; shoot_time: string | null; total_price: number | null;
    message: string | null; created_at: string;
  }>(
    `SELECT b.id, u.name as client_name, u.email as client_email, u.avatar_url as client_avatar,
            p.name as package_name, p.duration_minutes, p.num_photos,
            b.status, b.shoot_date, b.shoot_time, b.total_price, b.message, b.created_at
     FROM bookings b JOIN users u ON u.id = b.client_id LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.photographer_id = $1 ORDER BY b.created_at DESC`,
    [profile.id]
  );

  const allLocations = locations.map((l) => ({ slug: l.slug, name: l.name, region: l.region }));

  return (
    <div className="p-6 sm:p-8">
      <PhotographerDashboardClient
        profile={{ ...profile, location_slugs: locationRows.map((r) => r.location_slug) }}
        portfolioItems={portfolioItems}
        packages={packages}
        bookings={bookings}
        allLocations={allLocations}
        initialTab="profile"
      />
    </div>
  );
}
