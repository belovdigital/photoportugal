import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";
import { syncConnection, type ConnectionRow } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

async function loadProfile(userId: string) {
  return queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );
}

// Sanitize the row before returning to the client — we never echo the
// stored Google refresh/access tokens, just metadata.
function publicShape(row: ConnectionRow & { google_refresh_token: string | null; google_access_token: string | null }) {
  return {
    id: row.id,
    type: row.type,
    display_name: row.display_name,
    google_email: row.google_email,
    selected_calendar_ids: row.selected_calendar_ids,
    ical_url: row.ical_url,
    is_active: row.is_active,
    last_synced_at: row.last_synced_at,
    last_sync_error: row.last_sync_error,
    last_sync_event_count: row.last_sync_event_count,
  };
}

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await loadProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const rows = await query<ConnectionRow>(
    `SELECT id, photographer_id, type, display_name, google_email, google_refresh_token,
            google_access_token, google_access_token_expires_at, selected_calendar_ids,
            ical_url, is_active, last_synced_at, last_sync_error, last_sync_event_count
       FROM calendar_connections
      WHERE photographer_id = $1
      ORDER BY created_at`,
    [profile.id]
  );

  return NextResponse.json({ connections: rows.map(publicShape) });
}

export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await loadProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const type = body.type;
  if (type !== "ical") {
    // Google goes through its own OAuth callback, not this endpoint.
    return NextResponse.json({ error: "Use /api/calendar/google/connect for Google" }, { status: 400 });
  }

  const rawUrl = typeof body.ical_url === "string" ? body.ical_url.trim() : "";
  const displayName = typeof body.display_name === "string" && body.display_name.trim()
    ? body.display_name.trim().slice(0, 80)
    : "iCal calendar";

  if (!rawUrl) return NextResponse.json({ error: "ical_url required" }, { status: 400 });
  // Accept webcal:// (Apple), https://, http:// — normalize webcal to https
  // for storage so a single canonical form survives DB unique constraints.
  const normalized = rawUrl.replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(normalized)) {
    return NextResponse.json({ error: "URL must start with https://, http://, or webcal://" }, { status: 400 });
  }

  // Insert first; sync below — that way the row exists even if upstream
  // fetch fails, and the photographer sees the error message in the row.
  let row: ConnectionRow | null;
  try {
    row = await queryOne<ConnectionRow>(
      `INSERT INTO calendar_connections (photographer_id, type, display_name, ical_url)
       VALUES ($1, 'ical', $2, $3)
       RETURNING id, photographer_id, type, display_name, google_email, google_refresh_token,
                 google_access_token, google_access_token_expires_at, selected_calendar_ids,
                 ical_url, is_active, last_synced_at, last_sync_error, last_sync_event_count`,
      [profile.id, displayName, normalized]
    );
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "23505") {
      return NextResponse.json({ error: "This iCal URL is already connected" }, { status: 409 });
    }
    throw err;
  }

  if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  // Run an initial sync so the photographer sees real numbers immediately.
  // Errors don't fail the request — the row is created with the error msg
  // so the UI can display it and the photographer can fix the URL.
  const result = await syncConnection(row);

  // Re-fetch to get the updated last_synced_at / error.
  const refreshed = await queryOne<ConnectionRow>(
    `SELECT id, photographer_id, type, display_name, google_email, google_refresh_token,
            google_access_token, google_access_token_expires_at, selected_calendar_ids,
            ical_url, is_active, last_synced_at, last_sync_error, last_sync_event_count
       FROM calendar_connections WHERE id = $1`,
    [row.id]
  );

  return NextResponse.json({
    connection: refreshed ? publicShape(refreshed) : publicShape(row),
    sync: result,
  });
}
