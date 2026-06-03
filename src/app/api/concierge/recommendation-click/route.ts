import { NextRequest, NextResponse } from "next/server";
import { markClicked } from "@/lib/concierge/recommendation-events";

// Beacon endpoint: ConciergeChat fires this when a visitor clicks a
// photographer card it surfaced. Body shape: { chat_id, photographer_id }.
// Idempotent — the SQL only writes the first click timestamp per pair.
//
// We don't authenticate; visitor_id correlation lives in the chat row
// already, and an attacker writing fake clicks here would only inflate
// THEIR conversion stats with no upside.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const chatId = typeof body.chat_id === "string" ? body.chat_id : "";
    const photographerId = typeof body.photographer_id === "string" ? body.photographer_id : "";
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(chatId) || !UUID_RE.test(photographerId)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await markClicked(chatId, photographerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[recommendation-click] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
