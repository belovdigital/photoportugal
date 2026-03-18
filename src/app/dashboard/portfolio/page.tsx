import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { PhotographerDashboardClient } from "../photographer/PhotographerDashboardClient";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{
    id: string; slug: string; display_name: string; tagline: string | null; bio: string | null;
    avatar_url: string | null; cover_url: string | null; languages: string[]; shoot_types: string[];
    hourly_rate: number | null; experience_years: number; plan: string; rating: number;
    review_count: number; session_count: number; is_approved: boolean;
  }>(`SELECT pp.id, pp.slug, pp.display_name, pp.tagline, pp.bio, u.avatar_url, pp.cover_url,
      pp.languages, pp.shoot_types, pp.hourly_rate, pp.experience_years, pp.plan,
      pp.rating, pp.review_count, pp.session_count, pp.is_approved
      FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.user_id = $1`, [userId]);
  if (!profile) redirect("/dashboard");

  const locRows = await query<{ location_slug: string }>("SELECT location_slug FROM photographer_locations WHERE photographer_id = $1", [profile.id]);
  const items = await query("SELECT id, type, url, thumbnail_url, caption, location_slug, shoot_type, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order", [profile.id]);
  const pkgs = await query("SELECT id, name, description, duration_minutes, num_photos, price, is_popular, COALESCE(delivery_days, 7) as delivery_days FROM packages WHERE photographer_id = $1 ORDER BY price", [profile.id]);

  return (
    <div className="p-6 sm:p-8">
      <PhotographerDashboardClient
        profile={{ ...profile, location_slugs: locRows.map((r) => r.location_slug) }}
        portfolioItems={items as []} packages={pkgs as []} bookings={[]}
        allLocations={locations.map((l) => ({ slug: l.slug, name: l.name, region: l.region }))}
        initialTab="portfolio"
      />
    </div>
  );
}
