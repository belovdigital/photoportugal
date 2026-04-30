import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { listGoogleCalendars, syncConnection, type ConnectionRow } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadOwnedConnection(userId: string, connectionId: string): Promise<ConnectionRow | null> {
  if (!UUID_RE.test(connectionId)) return null;
  return queryOne<ConnectionRow>(
    `SELECT cc.id, cc.photographer_id, cc.type, cc.display_name, cc.google_email,
            cc.google_refresh_token, cc.google_access_token, cc.google_access_token_expires_at,
            cc.selected_calendar_ids, cc.ical_url, cc.is_active, cc.last_synced_at,
            cc.last_sync_error, cc.last_sync_event_count
       FROM calendar_connections cc
       JOIN photographer_profiles pp ON pp.id = cc.photographer_id
      WHERE cc.id = $1 AND pp.user_id = $2`,
    [connectionId, userId]
  );
}

// GET — list calendars on the connected Google account so the photographer
// can pick which ones count as busy.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const conn = await loadOwnedConnection(user.id, id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conn.type !== "google") return NextResponse.json({ error: "Only Google connections have selectable calendars" }, { status: 400 });

  try {
    const calendars = await listGoogleCalendars(conn);
    return NextResponse.json({ calendars });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

// PUT — replace which Google calendars are honoured as busy. Triggers an
// immediate resync so the dashboard reflects the new selection without
// waiting for the 15-min cron.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const conn = await loadOwnedConnection(user.id, id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conn.type !== "google") return NextResponse.json({ error: "Only Google connections have selectable calendars" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.selected_calendar_ids)) {
    return NextResponse.json({ error: "selected_calendar_ids must be an array" }, { status: 400 });
  }
  const ids = (body.selected_calendar_ids as unknown[])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, 50);

  await queryOne(
    "UPDATE calendar_connections SET selected_calendar_ids = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
    [ids, id]
  );

  // Re-sync so cached busy slots match the new selection. Errors here
  // surface on the row itself; we still return success.
  const refreshed = await loadOwnedConnection(user.id, id);
  if (refreshed) await syncConnection(refreshed);

  return NextResponse.json({ success: true, selected_calendar_ids: ids });
}
