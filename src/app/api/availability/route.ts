import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

// GET — fetch unavailability ranges for a photographer
// ?photographer_id=xxx (public) or own (authenticated photographer)
export async function GET(req: NextRequest) {
  const photographerId = req.nextUrl.searchParams.get("photographer_id");

  if (photographerId) {
    // Public: get active unavailability for a photographer.
    //
    // Two sources are merged:
    //   1. Manual blocks the photographer set themselves
    //      (photographer_unavailability — date ranges).
    //   2. Busy slots synced from their connected Google/Apple calendars
    //      (calendar_busy_slots — timestamp ranges). We collapse those to
    //      whole-day blocks: if a busy event hits any time between 06:00
    //      and 23:00 Lisbon time on a given date, that date is blocked.
    //      Pure-overnight events (e.g. someone marked their sleep schedule)
    //      don't count.
    //
    // The 06:00-23:00 window is intentionally generous — most real shoots
    // happen 09:00-19:00, but we don't want to assume; better to block a
    // day with a 06:30 dentist appointment than to surprise the client
    // with a `calendar_conflict` error at booking time.
    const manual = await query<{ id: string; date_from: string; date_to: string; reason: string | null }>(
      `SELECT id, date_from::text, date_to::text, reason
       FROM photographer_unavailability
       WHERE photographer_id = $1 AND date_to >= CURRENT_DATE
       ORDER BY date_from ASC`,
      [photographerId]
    );
    const synced = await query<{ blocked_date: string }>(
      `SELECT DISTINCT to_char(d, 'YYYY-MM-DD') AS blocked_date
         FROM calendar_busy_slots cbs,
              LATERAL generate_series(
                (cbs.starts_at AT TIME ZONE 'Europe/Lisbon')::date,
                (cbs.ends_at   AT TIME ZONE 'Europe/Lisbon')::date,
                '1 day'::interval
              ) AS d
        WHERE cbs.photographer_id = $1
          AND cbs.ends_at >= NOW()
          AND EXTRACT(HOUR FROM (cbs.starts_at AT TIME ZONE 'Europe/Lisbon')) < 23
          AND EXTRACT(HOUR FROM (cbs.ends_at   AT TIME ZONE 'Europe/Lisbon')) >= 6
        ORDER BY blocked_date ASC`,
      [photographerId]
    );
    const syncedRanges = synced.map((r, i) => ({
      // Sentinel id so client code can tell synced rows apart from manual
      // ones if it ever wants to (e.g. show a different tooltip). Manual
      // rows are real UUIDs.
      id: `synced-${i}`,
      date_from: r.blocked_date,
      date_to: r.blocked_date,
      reason: null,
    }));
    return NextResponse.json([...manual, ...syncedRanges]);
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
