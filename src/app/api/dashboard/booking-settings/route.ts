import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";

// Photographer-only dashboard endpoint for booking-rule settings — kept
// separate from /api/dashboard/profile because that endpoint replaces all
// profile fields and we just want to nudge a single value (min_lead_time_hours).
// Future booking rules (e.g. blackout periods, max bookings/day) live here.

// 0 = no minimum, 12h, then 1-10 days in daily steps, plus 14 days.
// Photographers think in days for advance notice; the 12h slot is the
// only sub-day option (for "next-morning" availability).
const ALLOWED_LEAD_TIMES = new Set([0, 12, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 336]);

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const row = await queryOne<{ min_lead_time_hours: number }>(
      "SELECT COALESCE(min_lead_time_hours, 0) as min_lead_time_hours FROM photographer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!row) return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });
    return NextResponse.json({ minLeadTimeHours: row.min_lead_time_hours });
  } catch (err) {
    console.error("[booking-settings] GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const raw = body?.minLeadTimeHours;
    const hours = typeof raw === "number" ? Math.round(raw) : parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(hours) || hours < 0 || hours > 720) {
      return NextResponse.json({ error: "minLeadTimeHours must be between 0 and 720" }, { status: 400 });
    }
    // Snap to the curated dropdown values to avoid arbitrary inputs from the UI.
    // We don't expose a custom-input today, so this is also a safety net.
    if (!ALLOWED_LEAD_TIMES.has(hours)) {
      return NextResponse.json({ error: "minLeadTimeHours value not allowed" }, { status: 400 });
    }

    const updated = await queryOne<{ id: string; min_lead_time_hours: number }>(
      `UPDATE photographer_profiles
       SET min_lead_time_hours = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING id, min_lead_time_hours`,
      [hours, user.id]
    );
    if (!updated) return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });
    return NextResponse.json({ success: true, minLeadTimeHours: updated.min_lead_time_hours });
  } catch (err) {
    console.error("[booking-settings] PATCH error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
