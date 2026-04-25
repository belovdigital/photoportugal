import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resume a recent chat for the visitor (or logged-in user) so reloads don't lose state.
// Looks back 7 days max.
export async function GET(req: NextRequest) {
  const visitorId = req.nextUrl.searchParams.get("visitor_id");
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!visitorId && !userId) return NextResponse.json({ chat: null });

  const row = await queryOne<{
    id: string;
    messages: unknown;
    matched_photographer_ids: string[] | null;
    email: string | null;
    first_name: string | null;
  }>(
    `SELECT id, messages, matched_photographer_ids, email, first_name
     FROM concierge_chats
     WHERE (
       ($1::uuid IS NOT NULL AND user_id = $1::uuid)
       OR ($2::varchar IS NOT NULL AND visitor_id = $2::varchar)
     )
       AND created_at > NOW() - INTERVAL '7 days'
       AND COALESCE(archived, FALSE) = FALSE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId || null, visitorId || null]
  ).catch(() => null);

  if (!row) return NextResponse.json({ chat: null });

  return NextResponse.json({
    chat: {
      id: row.id,
      messages: row.messages || [],
      email: row.email,
      first_name: row.first_name,
    },
  });
}
