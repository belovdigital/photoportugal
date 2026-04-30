import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { syncConnection, type ConnectionRow } from "@/lib/calendar-sync";

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

// Manual "sync now" trigger for the connection row in the dashboard.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const conn = await loadOwnedConnection(user.id, id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await syncConnection(conn);
  const refreshed = await queryOne<ConnectionRow>(
    "SELECT last_synced_at, last_sync_error, last_sync_event_count FROM calendar_connections WHERE id = $1",
    [id]
  );
  return NextResponse.json({ result, ...refreshed });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const conn = await loadOwnedConnection(user.id, id);
  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ON DELETE CASCADE on calendar_busy_slots takes care of cleanup.
  await queryOne("DELETE FROM calendar_connections WHERE id = $1 RETURNING id", [id]);
  return NextResponse.json({ success: true });
}
