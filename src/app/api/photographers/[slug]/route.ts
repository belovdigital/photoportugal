import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const profile = await queryOne<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      bio: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      cover_position_y: number;
      languages: string[];
      shoot_types: string[];
      experience_years: number;
      is_verified: boolean;
      is_featured: boolean;
      is_founding: boolean;
      rating: number;
      review_count: number;
      session_count: number;
    }>(
      `SELECT p.id, p.slug, u.name, p.tagline, p.bio,
              u.avatar_url, p.cover_url, p.cover_position_y,
              p.languages, p.shoot_types, p.experience_years,
              p.is_verified, p.is_featured, COALESCE(p.is_founding, FALSE) as is_founding,
              p.rating, p.review_count, p.session_count
       FROM photographer_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = $1 AND p.is_approved = TRUE`,
      [slug]
    );

    if (!profile) {
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

    // Locations
    const locations = await query<{ location_slug: string }>(
      "SELECT location_slug FROM photographer_locations WHERE photographer_id = $1",
      [profile.id]
    );

    // Packages
    const packages = await query<{
      id: string; name: string; description: string | null;
      duration_minutes: number; num_photos: number; price: number;
      is_popular: boolean; delivery_days: number;
    }>(
      "SELECT id, name, description, duration_minutes, num_photos, price, is_popular, COALESCE(delivery_days, 7) as delivery_days, COALESCE(features, '{}') as features FROM packages WHERE photographer_id = $1 AND is_public = TRUE ORDER BY sort_order, price",
      [profile.id]
    );

    // Portfolio
    const portfolio = await query<{
      id: string; image_url: string; thumbnail_url: string | null;
      caption: string | null; sort_order: number;
    }>(
      "SELECT id, url as image_url, thumbnail_url, caption, sort_order FROM portfolio_items WHERE photographer_id = $1 ORDER BY sort_order, created_at",
      [profile.id]
    );

    // Reviews
    const reviews = await query<{
      id: string; rating: number; title: string | null; text: string | null;
      client_name: string; created_at: string;
    }>(
      `SELECT r.id, r.rating, r.title, r.text,
              COALESCE(r.client_name_override, u.name, 'Anonymous') as client_name,
              r.created_at
       FROM reviews r
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.photographer_id = $1 AND COALESCE(r.is_approved, TRUE) = TRUE
       ORDER BY r.created_at DESC LIMIT 20`,
      [profile.id]
    );

    return NextResponse.json({
      ...profile,
      locations: locations.map(l => l.location_slug),
      packages,
      portfolio,
      reviews,
    });
  } catch (error) {
    console.error("[api/photographers] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
