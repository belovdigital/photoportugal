import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Archive ALL of the visitor's chats so /api/concierge/load no longer restores
// any of them. Called when user clicks "Start over" — they want a clean slate.
export async function POST(req: NextRequest) {
  const { chat_id, visitor_id } = await req.json().catch(() => ({}));

  let userId: string | null = null;
  try {
    const session = await auth();
    userId = (session?.user as { id?: string } | undefined)?.id || null;
  } catch {}

  if (!chat_id && !visitor_id && !userId) {
    return NextResponse.json({ ok: true });
  }

  // Archive every prior chat for this visitor / user (cleanest reset).
  // Plus the explicit chat_id if given (handles visitor cookie missing edge case).
  await query(
    `UPDATE concierge_chats
     SET archived = TRUE, updated_at = NOW()
     WHERE archived = FALSE
       AND (
         ($1::uuid IS NOT NULL AND id = $1::uuid)
         OR ($2::varchar IS NOT NULL AND visitor_id = $2::varchar)
         OR ($3::uuid IS NOT NULL AND user_id = $3::uuid)
       )`,
    [chat_id || null, visitor_id || null, userId || null]
  ).catch(() => null);

  return NextResponse.json({ ok: true });
}
