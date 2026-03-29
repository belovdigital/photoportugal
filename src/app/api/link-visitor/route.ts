import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

    const { visitor_id } = await req.json();
    if (!visitor_id) return NextResponse.json({ ok: true });

    // Link visitor_id to user (only if not already linked)
    await query("UPDATE users SET visitor_id = $1 WHERE id = $2 AND visitor_id IS NULL", [visitor_id, session.user.id]);

    // Backfill all unlinked sessions for this visitor
    await query("UPDATE visitor_sessions SET user_id = $1 WHERE visitor_id = $2 AND user_id IS NULL", [session.user.id, visitor_id]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[link-visitor]", e);
    return NextResponse.json({ ok: true });
  }
}
