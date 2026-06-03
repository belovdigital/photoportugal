import OpenAI from "openai";
import { query, queryOne } from "@/lib/db";

const MODEL = "gpt-4o-mini";

// Supported chat languages on the platform. Photographers pick PT or EN as
// their UI locale; clients write in any of the five — we translate only into
// PT or EN since those are the only audiences reading the result.
const SUPPORTED_TARGET = new Set(["en", "pt"]);

// Replace contact details with placeholders before sending to OpenAI. We don't
// want phone numbers or emails leaving the platform for the LLM provider.
function stripPII(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "[phone]")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/www\.[^\s]+/gi, "[url]");
}

export type SkipReason =
  | "too_short"
  | "no_alpha"
  | "booking_card"
  | "system_message"
  | "same_language"
  | "unsupported_target"
  | "detect_failed";

function precheckSkip(text: string | null, isSystem: boolean): SkipReason | null {
  if (!text) return "system_message";
  if (text.startsWith("BOOKING_CARD:")) return "booking_card";
  if (isSystem) return "system_message";
  const trimmed = text.trim();
  if (trimmed.length < 8) return "too_short";
  // Require at least 3 alphabetic chars — filters emoji-only / digits-only.
  const alphaCount = (trimmed.match(/\p{L}/gu) || []).length;
  if (alphaCount < 3) return "no_alpha";
  return null;
}

// Fast script-based detection. Cheap path to avoid an LLM call for messages
// we can confidently classify by character set alone.
function scriptDetect(text: string): string | null {
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[぀-ゟ゠-ヿ]/.test(text)) return "ja";
  if (/[؀-ۿ]/.test(text)) return "ar";
  return null;
}

async function detectLanguage(openai: OpenAI, text: string): Promise<string | null> {
  const scriptHit = scriptDetect(text);
  if (scriptHit) return scriptHit;
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_completion_tokens: 4,
      messages: [
        {
          role: "system",
          content: "You are a language identification engine. Reply with the ISO 639-1 two-letter code of the user message — nothing else, no punctuation, no quotes. Examples: en, pt, de, es, fr, ru, it, nl. If genuinely unsure, reply en.",
        },
        { role: "user", content: stripPII(text).slice(0, 500) },
      ],
    });
    const raw = (res.choices[0]?.message?.content || "").trim().toLowerCase();
    return raw.match(/^[a-z]{2}$/)?.[0] || null;
  } catch (err) {
    console.warn("[chat-translate] detect failed:", err);
    return null;
  }
}

async function translateText(openai: OpenAI, text: string, targetLang: string): Promise<string | null> {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You translate chat messages between a wedding/portrait photographer and a client on a booking platform. Translate the user message into ${targetLang === "pt" ? "European Portuguese" : "English"}. Keep the tone casual/professional as in the original. Preserve placeholders like [phone], [email], [url] verbatim. Reply with ONLY the translation — no quotes, no commentary.`,
        },
        { role: "user", content: stripPII(text).slice(0, 2000) },
      ],
    });
    const out = (res.choices[0]?.message?.content || "").trim();
    return out || null;
  } catch (err) {
    console.warn("[chat-translate] translate failed:", err);
    return null;
  }
}

export interface TranslateInput {
  message_id: string;
  text: string | null;
  is_system: boolean;
  recipient_locale: "en" | "pt";
}

// Translates a message and writes the result back to the row. Idempotent —
// uses `WHERE translated_at IS NULL` so concurrent triggers don't double-spend.
// Returns silently on any error; the original `text` remains visible.
export async function translateMessageRow(input: TranslateInput): Promise<void> {
  if (process.env.CHAT_TRANSLATION_ENABLED !== "1") return;
  if (!process.env.OPENAI_API_KEY) return;

  const { message_id, text, is_system, recipient_locale } = input;
  const target = recipient_locale === "pt" ? "pt" : "en";
  if (!SUPPORTED_TARGET.has(target)) {
    await markSkip(message_id, "unsupported_target");
    return;
  }

  const pre = precheckSkip(text, is_system);
  if (pre) {
    await markSkip(message_id, pre);
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const detected = await detectLanguage(openai, text!);
  if (!detected) {
    await markSkip(message_id, "detect_failed");
    return;
  }
  if (detected === target) {
    await query(
      `UPDATE messages
         SET detected_language = $2, translation_skip_reason = 'same_language', translated_at = NOW()
       WHERE id = $1 AND translated_at IS NULL`,
      [message_id, detected]
    );
    return;
  }

  const translated = await translateText(openai, text!, target);
  if (!translated) {
    await query(
      `UPDATE messages
         SET detected_language = $2, translation_skip_reason = 'detect_failed', translated_at = NOW()
       WHERE id = $1 AND translated_at IS NULL`,
      [message_id, detected]
    );
    return;
  }

  await query(
    `UPDATE messages
       SET detected_language = $2, translated_text = $3, translated_to_lang = $4, translated_at = NOW()
     WHERE id = $1 AND translated_at IS NULL`,
    [message_id, detected, translated, target]
  );
}

async function markSkip(message_id: string, reason: SkipReason): Promise<void> {
  await query(
    `UPDATE messages
       SET translation_skip_reason = $2, translated_at = NOW()
     WHERE id = $1 AND translated_at IS NULL`,
    [message_id, reason]
  );
}

// Resolves the recipient's UI locale (the language we should translate INTO).
// For client→photographer messages, the recipient is the photographer; for
// photographer→client, the recipient is the client.
export async function getRecipientLocale(
  sender_id: string,
  client_id: string,
  photographer_id: string
): Promise<"en" | "pt" | null> {
  // photographer_id here is photographer_profiles.id; fetch the user_id.
  const pp = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM photographer_profiles WHERE id = $1",
    [photographer_id]
  );
  if (!pp) return null;
  const recipientUserId = sender_id === pp.user_id ? client_id : pp.user_id;
  const u = await queryOne<{ locale: string | null }>(
    "SELECT locale FROM users WHERE id = $1",
    [recipientUserId]
  );
  const loc = (u?.locale || "en").toLowerCase();
  return loc === "pt" ? "pt" : "en";
}
