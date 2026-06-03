import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";
import {
  getBufferedBusyWindows,
  getPhotographerCalendarBufferMinutes,
  lisbonLocalMinutesToUtc,
} from "@/lib/booking-availability";

// GET — fetch unavailability ranges for a photographer
// ?photographer_id=xxx (public) or own (authenticated photographer)
// Cheap UUID shape check — guards against the literal string "undefined"
// or other non-UUID values that the book page sends while the
// photographer object is still loading. Without this, Postgres throws
// "invalid input syntax for type uuid: 'undefined'" and the request 500s.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const photographerId = req.nextUrl.searchParams.get("photographer_id");
  const includeSlots = req.nextUrl.searchParams.get("include_slots") === "1";

  if (photographerId && !UUID_RE.test(photographerId)) {
    return NextResponse.json({ error: "Invalid photographer_id" }, { status: 400 });
  }

  if (photographerId) {
    // Public: manual unavailable date ranges. New booking clients can ask
    // for include_slots=1 to also get exact buffered busy windows from
    // synced calendars and existing Photo Portugal bookings.
    const manual = await query<{ id: string; date_from: string; date_to: string; reason: string | null }>(
      `SELECT id, date_from::text, date_to::text, reason
       FROM photographer_unavailability
       WHERE photographer_id = $1 AND date_to >= CURRENT_DATE
       ORDER BY date_from ASC`,
      [photographerId]
    );
    if (includeSlots) {
      const today = new Date().toISOString().split("T")[0];
      const from = req.nextUrl.searchParams.get("from") || today;
      const to = req.nextUrl.searchParams.get("to") || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
      const bufferMinutes = await getPhotographerCalendarBufferMinutes(photographerId);
      const rangeStart = lisbonLocalMinutesToUtc(from, 0);
      const rangeEnd = lisbonLocalMinutesToUtc(to, 24 * 60);
      // Best-effort viewer detection — if the request carries a session,
      // exclude that viewer's own bookings from the busy windows so the
      // date-picker doesn't lock them out of their own holds (see
      // self-blocking case Teresa ↔ Maya 2026-06-01).
      const viewer = await authFromRequest(req).catch(() => null);
      const busyWindows = await getBufferedBusyWindows(photographerId, rangeStart, rangeEnd, bufferMinutes, undefined, viewer?.id);
      return NextResponse.json({
        ranges: manual,
        busy_windows: busyWindows,
        calendar_buffer_minutes: bufferMinutes,
      });
    }

    // Legacy response for old clients: date ranges only. We no longer turn
    // synced calendar events into whole unavailable days; booking-time checks
    // still reject conflicts using exact busy windows plus buffer.
    return NextResponse.json(manual);
  }

  // Authenticated: get own ranges
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1", [user.id]
  );
  if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

  const ranges = await query<{ id: string; date_from: string; date_to: string; reason: string | null }>(
    `SELECT id, date_from::text, date_to::text, reason
     FROM photographer_unavailability
     WHERE photographer_id = $1
     ORDER BY date_from ASC`,
    [profile.id]
  );

  return NextResponse.json(ranges);
}

// POST — add a new unavailability range
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1", [user.id]
  );
  if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

  const { date_from, date_to, reason } = await req.json();
  if (!date_from || !date_to) {
    return NextResponse.json({ error: "date_from and date_to are required" }, { status: 400 });
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO photographer_unavailability (photographer_id, date_from, date_to, reason)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [profile.id, date_from, date_to, reason || null]
  );

  return NextResponse.json({ id: row?.id });
}

// DELETE — remove an unavailability range
export async function DELETE(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1", [user.id]
  );
  if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

  const { id } = await req.json();
  await queryOne(
    "DELETE FROM photographer_unavailability WHERE id = $1 AND photographer_id = $2 RETURNING id",
    [id, profile.id]
  );

  return NextResponse.json({ success: true });
}
