import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  try {
    const { cover_position_y } = await req.json();
    const y = Math.round(Math.min(100, Math.max(0, Number(cover_position_y) || 50)));

    const profile = await queryOne<{ id: string; slug: string }>(
      "UPDATE photographer_profiles SET cover_position_y = $1 WHERE user_id = $2 RETURNING id, slug",
      [y, userId]
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    revalidatePath(`/photographers/${profile.slug}`);
    revalidatePath("/photographers");

    return NextResponse.json({ success: true, cover_position_y: y });
  } catch (error) {
    console.error("Cover position update error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/cover-position", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
