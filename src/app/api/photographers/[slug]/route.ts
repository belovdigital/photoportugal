import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { locations as allLocations } from "@/lib/locations-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      display_name: string;
      avatar_url: string | null;
    }>(
      `SELECT p.id, p.slug, p.display_name, u.avatar_url
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1 AND p.is_approved = TRUE`,
      [slug]
    );

    if (!profile) {
      // Check slug redirects
      const slugRedirect = await queryOne<{ new_slug: string }>(
        `SELECT pp.slug as new_slug FROM slug_redirects sr
         JOIN photographer_profiles pp ON pp.id = sr.photographer_id
         WHERE sr.old_slug = $1`,
        [slug]
      );
      if (slugRedirect) {
        return NextResponse.json({ redirect: `/photographers/${slugRedirect.new_slug}` }, { status: 301 });
      }
      return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
    }

    const locationRows = await query<{ location_slug: string }>(
      "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    );
    const locs = locationRows
      .map((r) => {
        const l = allLocations.find((loc) => loc.slug === r.location_slug);
        return l ? { slug: l.slug, name: l.name } : null;
      })
      .filter(Boolean);

    const pkgs = await query<{
      id: string;
      name: string;
      description: string | null;
      duration_minutes: number;
      num_photos: number;
      price: number;
      is_popular: boolean;
    }>(
      "SELECT id, name, description, duration_minutes, num_photos, price, is_popular FROM packages WHERE photographer_id = $1 ORDER BY sort_order, price",
      [profile.id]
    );

    return NextResponse.json({
      id: profile.id,
      display_name: profile.display_name,
      slug: profile.slug,
      avatar_url: profile.avatar_url,
      locations: locs,
      packages: pkgs,
    });
  } catch (error) {
    console.error("[api/photographers] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
