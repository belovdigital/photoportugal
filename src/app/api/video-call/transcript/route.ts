import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { queryOne } from "@/lib/db";
import { detectContactInfo } from "@/lib/content-filter";
import { sendTelegram } from "@/lib/telegram";
import { notifyPairMessage } from "@/lib/chat-notify";

export const dynamic = "force-dynamic";

interface SpeakerBlock {
  identity: string;
  started_at_ms: number;
  text: string;
}

// POST /api/video-call/transcript?secret=<CRON_SECRET>
// { room: "pp-<client8>-<photog8>", speakers: [{identity, started_at_ms, text}] }
// (legacy fallback: { room, text } — single mixed blob, no speakers)
//
// Called by transcribe.sh on the meet server. Each speaker's track is
// transcribed separately (good ASR, correct attribution) but WebRTC drops
// silence, so per-file timestamps can't reliably interleave the dialogue —
// instead a small LLM pass reconstructs chronological turn order from the
// content, with per-file start times as a hint. The combined text runs
// through the anti-disintermediation content filter — this is the control
// that lets us allow calls BEFORE payment.
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { room, speakers, text } = body as { room?: string; speakers?: SpeakerBlock[]; text?: string };
  const blocks = (Array.isArray(speakers) ? speakers : []).filter(
    (s) => s && typeof s.text === "string" && s.text.trim()
  );
  if (typeof room !== "string" || (blocks.length === 0 && !text?.trim())) {
    return NextResponse.json({ error: "room and speakers (or text) required" }, { status: 400 });
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
  if (blocks.length > 0) {
    const named = [...blocks]
      .sort((a, b) => (a.started_at_ms || 0) - (b.started_at_ms || 0))
      .map((b) => ({ name: nameFor(b.identity), offsetSec: Math.round(((b.started_at_ms || 0) - (blocks[0].started_at_ms || 0)) / 1000), text: b.text.trim() }));

    // Naive fallback: speaker blocks in join order
    composed = named.map((b) => `${b.name}: ${b.text}`).join("\n");

    if (named.length >= 2 && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content:
                "You reconstruct a phone-call dialogue. You get each speaker's OWN transcript (recorded on separate tracks from one call) plus the seconds offset when they joined. Interleave the utterances into the most plausible chronological dialogue: split each transcript into natural turns and order them so questions precede answers and reactions follow what they react to. Fix obvious speech-recognition errors (wrong homophones, broken words) conservatively; NEVER invent content that is not there; keep the original language of the speech; keep fillers only when meaningful. Output ONLY the dialogue, one utterance per line, formatted exactly as 'Name: utterance'. Use the speaker names as given.",
            },
            {
              role: "user",
              content: named
                .map((b) => `[${b.name}, joined at +${b.offsetSec}s]\n${b.text}`)
                .join("\n\n"),
            },
          ],
        });
        const out = res.choices[0]?.message?.content?.trim();
        // Sanity: accept only if it looks like a dialogue mentioning our speakers
        if (out && named.every((b) => out.includes(`${b.name}:`))) {
          composed = out;
        }
      } catch (e) {
        console.error("[transcript] dialogue reconstruction failed, using fallback:", e);
      }
    }
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

  return NextResponse.json({ ok: true, speakers: blocks.length, contact_flag: contactType || null });
}
