import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;

  try {
    const body = await req.json();
    const { display_name, tagline, bio, languages, hourly_rate, experience_years } = body;

    const profile = await queryOne(
      `UPDATE photographer_profiles
       SET display_name = $1, tagline = $2, bio = $3, languages = $4,
           hourly_rate = $5, experience_years = $6, updated_at = NOW()
       WHERE user_id = $7
       RETURNING id`,
      [display_name, tagline || null, bio || null, languages || [], hourly_rate, experience_years || 0, userId]
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
