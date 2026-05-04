import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import {
  photographerCalendarBufferColumnExists,
  normalizeBufferMinutes,
} from "@/lib/booking-availability";

// Photographer-only dashboard endpoint for booking-rule settings — kept
// separate from /api/dashboard/profile because that endpoint replaces all
// profile fields and we just want to nudge a single value (min_lead_time_hours).
// Future booking rules (e.g. blackout periods, max bookings/day) live here.

// 0 = no minimum, 12h, then 1-10 days in daily steps, plus 14 days.
// Photographers think in days for advance notice; the 12h slot is the
// only sub-day option (for "next-morning" availability).
const ALLOWED_LEAD_TIMES = new Set([0, 12, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 336]);
const ALLOWED_BUFFER_MINUTES = new Set([0, 30, 60, 90, 120, 180]);
const DEFAULT_BUFFER_MINUTES = 60;

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const hasBufferColumn = await photographerCalendarBufferColumnExists();
    const row = await queryOne<{ min_lead_time_hours: number; calendar_buffer_minutes?: number }>(
      hasBufferColumn
        ? `SELECT COALESCE(min_lead_time_hours, 0) as min_lead_time_hours,
                  COALESCE(calendar_buffer_minutes, $2) as calendar_buffer_minutes
             FROM photographer_profiles
            WHERE user_id = $1`
        : "SELECT COALESCE(min_lead_time_hours, 0) as min_lead_time_hours FROM photographer_profiles WHERE user_id = $1",
      hasBufferColumn ? [user.id, DEFAULT_BUFFER_MINUTES] : [user.id]
    );
    if (!row) return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });
    return NextResponse.json({
      minLeadTimeHours: row.min_lead_time_hours,
      calendarBufferMinutes: normalizeBufferMinutes(row.calendar_buffer_minutes ?? DEFAULT_BUFFER_MINUTES),
    });
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
    const rawBuffer = body?.calendarBufferMinutes;
    const hasLeadTime = raw !== undefined;
    const hasBuffer = rawBuffer !== undefined;

    if (!hasLeadTime && !hasBuffer) {
      return NextResponse.json({ error: "No setting provided" }, { status: 400 });
    }

    let hours = 0;
    if (hasLeadTime) {
      hours = typeof raw === "number" ? Math.round(raw) : parseInt(String(raw ?? ""), 10);
      if (!Number.isFinite(hours) || hours < 0 || hours > 720) {
        return NextResponse.json({ error: "minLeadTimeHours must be between 0 and 720" }, { status: 400 });
      }
      // Snap to the curated dropdown values to avoid arbitrary inputs from the UI.
      // We don't expose a custom-input today, so this is also a safety net.
      if (!ALLOWED_LEAD_TIMES.has(hours)) {
        return NextResponse.json({ error: "minLeadTimeHours value not allowed" }, { status: 400 });
      }
    }

    let bufferMinutes = DEFAULT_BUFFER_MINUTES;
    if (hasBuffer) {
      bufferMinutes = normalizeBufferMinutes(rawBuffer);
      if (!ALLOWED_BUFFER_MINUTES.has(bufferMinutes)) {
        return NextResponse.json({ error: "calendarBufferMinutes value not allowed" }, { status: 400 });
      }
    }

    const hasBufferColumn = await photographerCalendarBufferColumnExists();
    if (hasBuffer && !hasBufferColumn) {
      return NextResponse.json({ error: "calendar_buffer_minutes column missing" }, { status: 503 });
    }
    const updated = await queryOne<{ id: string; min_lead_time_hours: number; calendar_buffer_minutes?: number }>(
      hasBufferColumn
        ? `UPDATE photographer_profiles
             SET min_lead_time_hours = CASE WHEN $1::boolean THEN $2 ELSE min_lead_time_hours END,
                 calendar_buffer_minutes = CASE WHEN $3::boolean THEN $4 ELSE calendar_buffer_minutes END,
                 updated_at = NOW()
           WHERE user_id = $5
           RETURNING id, min_lead_time_hours, calendar_buffer_minutes`
        : `UPDATE photographer_profiles
             SET min_lead_time_hours = CASE WHEN $1::boolean THEN $2 ELSE min_lead_time_hours END,
                 updated_at = NOW()
           WHERE user_id = $3
           RETURNING id, min_lead_time_hours`,
      hasBufferColumn
        ? [hasLeadTime, hours, hasBuffer, bufferMinutes, user.id]
        : [hasLeadTime, hours, user.id]
    );
    if (!updated) return NextResponse.json({ error: "Photographer profile not found" }, { status: 404 });
    return NextResponse.json({
      success: true,
      minLeadTimeHours: updated.min_lead_time_hours,
      calendarBufferMinutes: normalizeBufferMinutes(updated.calendar_buffer_minutes ?? DEFAULT_BUFFER_MINUTES),
    });
  } catch (err) {
    console.error("[booking-settings] PATCH error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
