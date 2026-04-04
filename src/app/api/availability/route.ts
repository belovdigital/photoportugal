import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

// GET — fetch unavailability ranges for a photographer
// ?photographer_id=xxx (public) or own (authenticated photographer)
export async function GET(req: NextRequest) {
  const photographerId = req.nextUrl.searchParams.get("photographer_id");

  if (photographerId) {
    // Public: get active unavailability for a photographer
    const ranges = await query<{ id: string; date_from: string; date_to: string; reason: string | null }>(
      `SELECT id, date_from::text, date_to::text, reason
       FROM photographer_unavailability
       WHERE photographer_id = $1 AND date_to >= CURRENT_DATE
       ORDER BY date_from ASC`,
      [photographerId]
    );
    return NextResponse.json(ranges);
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
