import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const body = await req.json();
    const {
      display_name,
      tagline,
      bio,
      languages,
      shoot_types,
      hourly_rate,
      experience_years,
      locations: locationSlugs,
    } = body;

    const profile = await queryOne<{ id: string }>(
      `UPDATE photographer_profiles
       SET display_name = $1, tagline = $2, bio = $3, languages = $4,
           shoot_types = $5, hourly_rate = $6, experience_years = $7, updated_at = NOW()
       WHERE user_id = $8
       RETURNING id`,
      [
        display_name,
        tagline || null,
        bio || null,
        languages || [],
        shoot_types || [],
        hourly_rate,
        experience_years || 0,
        userId,
      ]
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Update locations (many-to-many)
    if (Array.isArray(locationSlugs)) {
      await query("DELETE FROM photographer_locations WHERE photographer_id = $1", [profile.id]);
      for (const slug of locationSlugs) {
        await query(
          "INSERT INTO photographer_locations (photographer_id, location_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [profile.id, slug]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
