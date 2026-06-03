import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";

// Booking-intent sidebar (Phase 3): the photographer opens a chat and sees a
// compact summary of what the client actually wants — extracted from the
// whole conversation by an LLM. Cached for 10 minutes so opening the chat
// twice doesn't double the LLM bill.

interface IntentResult {
  shoot_date: string | null;
  location: string | null;
  occasion: string | null;
  group_size: number | null;
  budget: string | null;
  client_language: string | null;
  preferred_package: string | null;
  notes: string | null;
}

const intentCache = new Map<string, { result: IntentResult; expiresAt: number; lastMessageId: string }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function stripPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[phone]")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/www\.[^\s]+/gi, "[url]");
}

export async function GET(req: NextRequest) {
  if (process.env.CHAT_INTENT_ENABLED !== "1") {
    return NextResponse.json({ error: "Intent feature disabled" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookingId = req.nextUrl.searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // Authorize + resolve conversation key.
  const booking = await queryOne<{ client_id: string; photographer_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, b.photographer_id, u.id AS photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.client_id !== user.id && booking.photographer_user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Pull the conversation thread (latest 30 messages) and the most-recent
  // message id — the latter is the cache key invalidator.
  const msgs = await query<{ id: string; text: string | null; sender_id: string; created_at: string }>(
    `SELECT id, text, sender_id, created_at
       FROM messages
      WHERE client_id = $1 AND photographer_id = $2
        AND text IS NOT NULL
        AND COALESCE(is_system, FALSE) = FALSE
      ORDER BY created_at DESC
      LIMIT 30`,
    [booking.client_id, booking.photographer_id]
  );
  if (msgs.length === 0) {
    return NextResponse.json({ result: null, reason: "empty_thread" });
  }
  const lastMessageId = msgs[0].id;

  const cacheKey = `${booking.client_id}:${booking.photographer_id}`;
  const cached = intentCache.get(cacheKey);
  if (cached && cached.lastMessageId === lastMessageId && cached.expiresAt > Date.now()) {
    return NextResponse.json({ result: cached.result, cached: true });
  }

  // Sort oldest→newest for the LLM prompt so it understands the flow.
  const ordered = [...msgs].reverse();
  const transcript = ordered
    .map((m) => {
      const who = m.sender_id === booking.photographer_user_id ? "PHOTOGRAPHER" : "CLIENT";
      return `${who}: ${stripPII(m.text || "")}`;
    })
    .join("\n")
    .slice(0, 8000);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You read a chat between a wedding/portrait photographer and a potential client on a booking platform in Portugal. Extract the client\'s booking intent into a strict JSON object with these keys (use null when missing, do NOT guess):\n' +
            '- shoot_date: ISO date "YYYY-MM-DD" if explicitly stated; otherwise null.\n' +
            '- location: city/region name as the client said it (e.g. "Comporta", "Lisbon").\n' +
            '- occasion: one of "couples", "family", "wedding", "engagement", "maternity", "solo", "boudoir", "event", "real_estate", "other"; null if unclear.\n' +
            '- group_size: integer headcount.\n' +
            '- budget: free text, e.g. "around 300€" or null.\n' +
            '- client_language: ISO 639-1 code the client mostly writes in.\n' +
            '- preferred_package: short label of the package the client is leaning toward, if a BOOKING_CARD was sent and discussed.\n' +
            '- notes: ONE short sentence, max 12 words, capturing anything important that isn\'t in the structured fields (e.g. "wants sunset light", "kids under 5", "open to alt dates"). Skip if nothing notable.\n\n' +
            'Reply with ONLY the JSON object. No commentary. No code fences.',
        },
        { role: "user", content: transcript },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: IntentResult;
    try {
      const obj = JSON.parse(raw);
      parsed = {
        shoot_date: typeof obj.shoot_date === "string" ? obj.shoot_date : null,
        location: typeof obj.location === "string" ? obj.location : null,
        occasion: typeof obj.occasion === "string" ? obj.occasion : null,
        group_size: typeof obj.group_size === "number" ? obj.group_size : null,
        budget: typeof obj.budget === "string" ? obj.budget : null,
        client_language: typeof obj.client_language === "string" ? obj.client_language : null,
        preferred_package: typeof obj.preferred_package === "string" ? obj.preferred_package : null,
        notes: typeof obj.notes === "string" ? obj.notes : null,
      };
    } catch {
      return NextResponse.json({ error: "Intent parse failed" }, { status: 502 });
    }

    intentCache.set(cacheKey, { result: parsed, expiresAt: Date.now() + CACHE_TTL_MS, lastMessageId });
    return NextResponse.json({ result: parsed, cached: false });
  } catch (err) {
    console.error("[chat/intent] error:", err);
    return NextResponse.json({ error: "Intent extraction failed" }, { status: 502 });
  }
}
