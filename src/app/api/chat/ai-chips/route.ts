import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";

// AI-generated short reply chips (Phase 5). The photographer opens a chat;
// we generate 2-3 short, photographer-voiced reply drafts based on the last
// few client messages, the photographer's profile, and the booking intent.
// Photographer can click to prefill, or click "None of these fit" — both
// outcomes are logged to chat_chip_feedback for offline evaluation.

interface ChipResult { text: string }

const chipsCache = new Map<string, { chips: ChipResult[]; expiresAt: number; lastMessageId: string }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function stripPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[phone]")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/www\.[^\s]+/gi, "[url]");
}

export async function GET(req: NextRequest) {
  if (process.env.CHAT_AI_CHIPS_ENABLED !== "1") {
    return NextResponse.json({ chips: [], reason: "disabled" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ chips: [], reason: "no_openai" });
  }

  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookingId = req.nextUrl.searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // Authorize + resolve conversation key. Only the photographer side gets
  // suggestion chips (the client doesn't need help drafting messages).
  const booking = await queryOne<{ client_id: string; photographer_id: string; photographer_user_id: string }>(
    `SELECT b.client_id, b.photographer_id, u.id AS photographer_user_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.photographer_user_id !== user.id) {
    // Client side — no chips needed, return empty.
    return NextResponse.json({ chips: [], reason: "client_side" });
  }

  // Pull recent messages, photographer profile, and the most-recent client
  // message id (cache invalidator: chips refresh as soon as the client
  // sends a new message).
  const msgs = await query<{ id: string; text: string | null; sender_id: string; created_at: string }>(
    `SELECT id, text, sender_id, created_at
       FROM messages
      WHERE client_id = $1 AND photographer_id = $2
        AND text IS NOT NULL
        AND COALESCE(is_system, FALSE) = FALSE
      ORDER BY created_at DESC
      LIMIT 8`,
    [booking.client_id, booking.photographer_id]
  );
  if (msgs.length === 0) return NextResponse.json({ chips: [], reason: "empty_thread" });
  // Chips only make sense when the photographer hasn't replied yet — they
  // suggest a REPLY to the client's latest message. If the photographer
  // already wrote (text OR media), suggestions are noise. We query the
  // very latest message across the whole thread (including media-only,
  // excluding system) so a photographer photo reply doesn't slip past.
  const veryLast = await queryOne<{ sender_id: string }>(
    `SELECT sender_id FROM messages
      WHERE client_id = $1 AND photographer_id = $2
        AND COALESCE(is_system, FALSE) = FALSE
      ORDER BY created_at DESC LIMIT 1`,
    [booking.client_id, booking.photographer_id]
  );
  if (!veryLast || veryLast.sender_id === booking.photographer_user_id) {
    return NextResponse.json({ chips: [], reason: "photographer_was_last" });
  }
  // The text-content version is needed for the LLM prompt; pick the most
  // recent client TEXT message (could be older than veryLast if the
  // client just sent a photo without caption — chips still useful then,
  // and the AI can reply to the photo).
  const lastClientMsg = msgs.find((m) => m.sender_id !== booking.photographer_user_id) || msgs[0];

  const cacheKey = `${booking.client_id}:${booking.photographer_id}`;
  const cached = chipsCache.get(cacheKey);
  if (cached && cached.lastMessageId === lastClientMsg.id && cached.expiresAt > Date.now()) {
    return NextResponse.json({ chips: cached.chips, cached: true });
  }

  // Gather photographer voice context: locale (drives chip language),
  // bio/tagline/shoot_types, and packages they offer.
  const profile = await queryOne<{
    locale: string | null; name: string | null; tagline: string | null; bio: string | null;
    shoot_types: string[] | null; languages: string[] | null;
  }>(
    `SELECT u.locale, u.name, pp.tagline, pp.bio, pp.shoot_types, pp.languages
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.id = $1`,
    [booking.photographer_id]
  );
  const photographerLocale = (profile?.locale || "en").toLowerCase() === "pt" ? "pt" : "en";

  const packages = await query<{ name: string; price: number; duration_minutes: number; num_photos: number }>(
    `SELECT name, price, duration_minutes, num_photos
       FROM packages
      WHERE photographer_id = $1 AND is_public = TRUE
      ORDER BY price ASC LIMIT 6`,
    [booking.photographer_id]
  );

  const ordered = [...msgs].reverse();
  const transcript = ordered
    .map((m) => `${m.sender_id === booking.photographer_user_id ? "ME" : "CLIENT"}: ${stripPII(m.text || "")}`)
    .join("\n")
    .slice(0, 6000);

  const profileBlock = [
    profile?.tagline ? `Tagline: ${profile.tagline}` : "",
    profile?.shoot_types?.length ? `Specialties: ${profile.shoot_types.join(", ")}` : "",
    packages.length
      ? `Packages: ${packages.map((p) => `${p.name} (€${Math.round(p.price)}, ${p.duration_minutes}min, ${p.num_photos} photos)`).join(" · ")}`
      : "",
  ].filter(Boolean).join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_completion_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are helping a photographer on Photo Portugal draft a short, friendly reply to a client. Your job: propose 2-3 distinct short reply options (1-2 sentences each, max ~25 words each). Write in ${photographerLocale === "pt" ? "European Portuguese" : "natural conversational English"}.\n\n` +
            `Constraints:\n` +
            `- Reply to the LAST CLIENT message in the transcript — not earlier ones.\n` +
            `- Stay grounded in the photographer's actual packages/specialties. Do NOT invent prices, dates, locations, or services they didn't mention.\n` +
            `- Do NOT include greetings/sign-offs unless the conversation just started.\n` +
            `- Each option should take a DIFFERENT angle (e.g. one confirming, one asking a clarifying question, one suggesting a package).\n` +
            `- No emojis unless the client used one first.\n\n` +
            `Reply with a strict JSON object: {"chips": [{"text": "..."}, {"text": "..."}]} — no commentary, no code fences.`,
        },
        {
          role: "user",
          content: `PHOTOGRAPHER PROFILE:\n${profileBlock || "(no profile info)"}\n\nCONVERSATION (oldest → newest):\n${transcript}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    let chips: ChipResult[] = [];
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj.chips)) {
        chips = obj.chips
          .filter((c: { text?: string } | null) => c && typeof c.text === "string" && c.text.trim().length > 0)
          .slice(0, 3)
          .map((c: { text: string }) => ({ text: c.text.trim() }));
      }
    } catch {
      return NextResponse.json({ chips: [], reason: "parse_failed" });
    }

    chipsCache.set(cacheKey, { chips, expiresAt: Date.now() + CACHE_TTL_MS, lastMessageId: lastClientMsg.id });
    return NextResponse.json({ chips, cached: false });
  } catch (err) {
    console.error("[chat/ai-chips] error:", err);
    return NextResponse.json({ chips: [], reason: "llm_error" });
  }
}
