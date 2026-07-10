import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { detectContactInfo } from "@/lib/content-filter";
import { sendTelegram } from "@/lib/telegram";
import { notifyPairMessage } from "@/lib/chat-notify";

export const dynamic = "force-dynamic";

interface Entry {
  identity: string;
  t: number; // absolute epoch seconds of utterance start
  text: string;
}

// POST /api/video-call/transcript?secret=<CRON_SECRET>
// { room: "pp-<client8>-<photog8>", entries: [{identity, t, text}] }
// (legacy fallback: { room, text } — single mixed blob, no speakers)
//
// Called by transcribe.sh on the meet server. Each speaker's track is
// transcribed with WORD-level timestamps; the egress start epoch anchors
// every word on a shared wall clock (verified: LiveKit track egress
// preserves real-time gaps). Utterances are ordered by their real start
// time — no turn-taking assumption, no LLM guessing: simultaneous speech
// comes out as adjacent lines ordered by who started first, exactly like
// Zoom renders call transcripts. The combined text runs through the
// anti-disintermediation content filter — this is the control that lets us
// allow calls BEFORE payment.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { room, entries, text } = body as { room?: string; entries?: Entry[]; text?: string };
  const list = (Array.isArray(entries) ? entries : []).filter(
    (e) => e && typeof e.text === "string" && e.text.trim()
  );
  if (typeof room !== "string" || (list.length === 0 && !text?.trim())) {
    return NextResponse.json({ error: "room and entries (or text) required" }, { status: 400 });
  }
  const m = room.match(/^pp-([0-9a-f]{8})-([0-9a-f]{8})$/);
  if (!m) {
    return NextResponse.json({ error: "unknown room format" }, { status: 400 });
  }
  const [, client8, photog8] = m;

  // Latest booking of the pair carries the thread (conversation-scoped chat)
  const booking = await queryOne<{
    id: string;
    client_id: string;
    photographer_id: string;
    photographer_user_id: string;
    client_name: string;
    photographer_name: string;
  }>(
    `SELECT b.id, b.client_id, b.photographer_id, u.id as photographer_user_id,
            cu.name as client_name, u.name as photographer_name
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.client_id::text LIKE $1 || '%' AND b.photographer_id::text LIKE $2 || '%'
     ORDER BY b.created_at DESC LIMIT 1`,
    [client8, photog8]
  );
  if (!booking) {
    return NextResponse.json({ error: "pair not found" }, { status: 404 });
  }

  const firstName = (full: string | null) => (full || "").trim().split(/\s+/)[0] || "Speaker";
  const nameFor = (identity: string): string => {
    if (identity === booking.client_id) return firstName(booking.client_name);
    if (identity === booking.photographer_user_id) return firstName(booking.photographer_name);
    return "Guest";
  };

  let composed: string;
  if (list.length > 0) {
    const sorted = [...list].sort((a, b) => (a.t || 0) - (b.t || 0));
    const lines: { name: string; text: string }[] = [];
    for (const e of sorted) {
      const name = nameFor(e.identity);
      const last = lines[lines.length - 1];
      if (last && last.name === name) {
        last.text += " " + e.text.trim();
      } else {
        lines.push({ name, text: e.text.trim() });
      }
    }
    composed = lines.map((l) => `${l.name}: ${l.text}`).join("\n");
  } else {
    composed = text!.trim();
  }

  const clipped = composed.slice(0, 50_000);
  const inserted = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO messages (booking_id, sender_id, text, is_system, client_id, photographer_id)
     VALUES ($1, $2, $3, TRUE, $4, $5) RETURNING id, created_at`,
    [
      booking.id,
      booking.photographer_user_id,
      `CALL_TRANSCRIPT:${JSON.stringify({ text: clipped, at: new Date().toISOString() })}`,
      booking.client_id,
      booking.photographer_id,
    ]
  );

  // Live-push into any open chat windows (ws-server rooms)
  if (inserted) {
    await notifyPairMessage({
      clientId: booking.client_id,
      photographerId: booking.photographer_id,
      message: {
        id: inserted.id,
        text: `CALL_TRANSCRIPT:${JSON.stringify({ text: clipped, at: inserted.created_at })}`,
        sender_id: booking.photographer_user_id,
        sender_name: firstName(booking.photographer_name),
        created_at: inserted.created_at,
        is_system: true,
      },
    });
  }

  // Spoken contact exchange → same alert path as typed contact exchange
  const contactType = detectContactInfo(clipped);
  if (contactType) {
    await sendTelegram(
      `📞🚨 Возможный обмен контактами В ЗВОНКЕ (${contactType})\n` +
        `Пара: ${booking.client_name} ↔ ${booking.photographer_name}\n` +
        `Booking: ${booking.id}\n` +
        `Транскрипт уже в чате — проверьте.`,
      "alerts"
    );
  }

  return NextResponse.json({ ok: true, utterances: list.length, contact_flag: contactType || null });
}
