import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { authFromRequest } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";

// Strips contact info before sending to OpenAI — same pattern as chat-translate.
function stripPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[phone]")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/www\.[^\s]+/gi, "[url]");
}

// Translates a photographer's draft into another language so they can review
// the result before pressing Send. Returns ONLY the translation — the
// frontend then replaces the textarea content and lets the photographer
// edit/send as usual.
export async function POST(req: NextRequest) {
  if (process.env.CHAT_TRANSLATION_ENABLED !== "1") {
    return NextResponse.json({ error: "Translation feature disabled" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
  }

  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; target?: "en" | "pt" } = {};
  try { body = await req.json(); } catch {}
  const text = (body.text || "").trim();
  const target = body.target === "pt" ? "pt" : "en";
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "text too long" }, { status: 400 });

  // Rate-limit per user — every translate costs an OpenAI call, so a runaway
  // hotkey or browser bug shouldn't burn budget.
  const { checkRateLimit } = await import("@/lib/rate-limit");
  if (!checkRateLimit(`outbound-translate:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many translations, please wait a moment" }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You translate chat drafts written by a photographer for a client on a booking platform. Translate the user message into ${target === "pt" ? "European Portuguese" : "natural, warm English"}. Preserve the photographer's tone (friendly, professional, casual). Keep placeholders like [phone], [email], [url] verbatim. Do NOT add greetings/closings that aren't in the source. Reply with ONLY the translation — no quotes, no commentary.`,
        },
        { role: "user", content: stripPII(text) },
      ],
    });
    const translated = (res.choices[0]?.message?.content || "").trim();
    if (!translated) {
      return NextResponse.json({ error: "Translation produced empty result" }, { status: 502 });
    }
    return NextResponse.json({ translated, target });
  } catch (err) {
    console.error("[chat/translate-outbound] error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 502 });
  }
}
