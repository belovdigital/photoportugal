import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authFromRequest } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";

// "Polish to English" with tone variants (Phase 6). The photographer types a
// rough English draft; we return TWO polished versions: warm and
// professional. Photographer picks one (or neither) and edits as needed.

function stripPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[phone]")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/www\.[^\s]+/gi, "[url]");
}

export async function POST(req: NextRequest) {
  if (process.env.CHAT_POLISH_ENABLED !== "1") {
    return NextResponse.json({ error: "Polish feature disabled" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string } = {};
  try { body = await req.json(); } catch {}
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "text too long" }, { status: 400 });

  const { checkRateLimit } = await import("@/lib/rate-limit");
  if (!checkRateLimit(`polish:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many polish requests, please wait a moment" }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You polish a photographer\'s rough English chat draft into natural English. Return TWO variants in the SAME language as the input (English-only feature for now):\n' +
            '- "warm": friendly, approachable tone — like talking to a friend. Casual but professional. Can include warmth markers like "happy to", "looking forward".\n' +
            '- "professional": clear, concise, business-like. Polite but no fluff.\n\n' +
            'Rules:\n' +
            '- Same MEANING as the original — do NOT add commitments, prices, dates, or details that aren\'t in the source.\n' +
            '- Preserve placeholders like [phone], [email], [url] verbatim.\n' +
            '- Each variant max ~50 words. Single-paragraph.\n' +
            '- No emojis unless the original had them.\n\n' +
            'Reply with strict JSON: {"warm": "...", "professional": "..."} — no commentary, no code fences.',
        },
        { role: "user", content: stripPII(text) },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    try {
      const obj = JSON.parse(raw);
      const warm = typeof obj.warm === "string" ? obj.warm.trim() : null;
      const professional = typeof obj.professional === "string" ? obj.professional.trim() : null;
      if (!warm || !professional) {
        return NextResponse.json({ error: "Polish produced incomplete result" }, { status: 502 });
      }
      return NextResponse.json({ warm, professional });
    } catch {
      return NextResponse.json({ error: "Polish parse failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("[chat/polish] error:", err);
    return NextResponse.json({ error: "Polish failed" }, { status: 502 });
  }
}
