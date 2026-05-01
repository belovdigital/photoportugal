import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { query, queryOne } from "@/lib/db";
import { authFromRequest } from "@/lib/mobile-auth";
import { loadPhotographersForConcierge } from "@/lib/concierge/photographer-context";
import { buildSystemPrompt } from "@/lib/concierge/system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// gpt-5.4-mini pricing per 1M tokens (April 2026)
const COST_PER_1M_INPUT = 0.75;
const COST_PER_1M_OUTPUT = 4.50;
const MODEL = "gpt-5.4-mini";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "show_locations",
      description: "Suggest 2-4 Portugal locations as clickable cards when the visitor is undecided WHERE to shoot. ONLY use slugs from this list: lisbon, sintra, cascais, douro-valley, porto, algarve, lagos, faro, albufeira, tavira, madeira, comporta, caparica, setubal, arrabida, aveiro, guimaraes, coimbra, nazare, evora, obidos, ericeira, sesimbra, peniche, geres, funchal, ponta-delgada, azores, tomar. Use this BEFORE show_matches when the visitor has not picked a specific city.",
      parameters: {
        type: "object",
        properties: {
          locations: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                slug: { type: "string", description: "Location slug (must be from the list above)" },
                reason: { type: "string", description: "Why this location fits — 1 sentence, max 140 chars" },
              },
              required: ["slug", "reason"],
            },
          },
          reply_text: { type: "string", description: "Short intro line above the location cards, e.g. 'Three great spots for an ocean proposal:'" },
        },
        required: ["locations", "reply_text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "show_matches",
      description: "Show 3 photographer matches to the user. ONLY call this once the visitor has CONFIRMED ONE specific location (not 'one of these three'). Never call this in the same turn as show_locations.",
      parameters: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                slug: { type: "string", description: "The photographer's slug from the list" },
                reasoning: { type: "string", description: "1-2 sentences explaining why this photographer fits this specific visitor" },
              },
              required: ["slug", "reasoning"],
            },
          },
          reply_text: { type: "string", description: "Friendly intro line to display above the cards, e.g. 'Based on what you said, here are 3 great matches:'" },
        },
        required: ["matches", "reply_text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_human_match",
      description: "Use this only as fallback when you genuinely cannot match (location with no photographers, weird request, etc). A human will follow up within 4h.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why automated matching doesn't fit this case" },
          summary: { type: "string", description: "Short summary of what the visitor wants for the human to act on" },
        },
        required: ["reason", "summary"],
      },
    },
  },
];

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

// Lightweight language detector based on script + characteristic words.
// Returns ISO 639-1 code or null if uncertain. Doesn't pretend to be perfect —
// just good enough to lock the AI into the right language.
function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 2) return null;
  const s = text.trim();
  if (/[А-Яа-яЁё]/.test(s)) return "ru";
  if (/[֐-׿]/.test(s)) return "he";
  if (/[一-鿿]/.test(s)) return "zh";
  if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";
  if (/[؀-ۿ]/.test(s)) return "ar";
  const lower = s.toLowerCase();
  // Portuguese — distinctive cues
  if (/\b(olá|obrigad[oa]|fotógrafo|fotografia|sessão|casamento|onde|estou|gostaria)\b/.test(lower) || /[ãõçáéíóúâêôà]/.test(lower)) return "pt";
  // German — distinctive cues
  if (/\b(hallo|guten|möchte|fotograf|hochzeit|wo|ich|bin|wir|für|sind|nach)\b/.test(lower) || /[äöüß]/.test(lower)) return "de";
  // Spanish
  if (/\b(hola|gracias|fotógrafo|boda|dónde|estoy|quiero|para)\b/.test(lower) || /[ñ¿¡]/.test(lower)) return "es";
  // French
  if (/\b(bonjour|merci|photographe|mariage|où|je|suis|nous|sommes)\b/.test(lower) || /[àâçéèêëîïôûüÿœæ]/.test(lower)) return "fr";
  return null;
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { chat_id, visitor_id, messages, email, first_name, language, source, page_context } = body as {
    chat_id?: string;
    visitor_id?: string;
    messages: IncomingMessage[];
    email?: string;
    first_name?: string;
    language?: string;
    source?: "page" | "drawer";
    page_context?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Pre-LLM jailbreak filter — short-circuit before spending tokens
  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const lower = lastUser.toLowerCase();
  const jailbreakPatterns = [
    /ignore (all |the )?(previous|above|prior) (instructions?|prompts?|rules?)/,
    /system\s*prompt/,
    /reveal (your |the )?(prompt|instructions|system)/,
    /repeat (the |your )?(above|system|instructions)/,
    /show me (your |the )?(prompt|instructions)/,
    /\bDAN\b|\bjailbreak\b/i,
    /you are now/,
    /pretend (to be|you are)/,
    /act as (?!a photographer|the concierge)/,
  ];
  if (jailbreakPatterns.some(rx => rx.test(lower))) {
    return NextResponse.json({
      chat_id: undefined,
      reply: "I'm just the photographer matchmaker — let's stick to finding you the right pro. Where in Portugal are you going?",
      action: null,
      usage: null,
    });
  }
  if (lastUser.length > 1500) {
    return NextResponse.json({
      reply: "Let's keep things short — give me a sentence or two about your Portugal trip and I'll find you 3 great photographers.",
      action: null,
      usage: null,
    });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Pull user_id from session if authenticated — used both for memory lookup
  // and for chat→user linkage during INSERT below. authFromRequest handles
  // both NextAuth cookies (web) and Bearer JWT (mobile).
  let userId: string | null = null;
  try {
    const u = await authFromRequest(req);
    userId = u?.id || null;
  } catch {}

  // Persona memory — pull a short summary from the visitor's previous (archived) chats
  // so the AI remembers context across visits. Only kicks in for new chats (no chat_id yet).
  let personaMemory = "";
  if (!chat_id && (visitor_id || userId)) {
    const priorChats = await query<{ messages: { role: string; content: string }[] }>(
      `SELECT messages FROM concierge_chats
       WHERE (
         ($1::varchar IS NOT NULL AND visitor_id = $1::varchar)
         OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
       )
       AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC LIMIT 3`,
      [visitor_id || null, userId || null]
    ).catch(() => [] as { messages: { role: string; content: string }[] }[]);
    const priorUserMsgs = priorChats
      .flatMap((c) => (c.messages || []).filter((m) => m.role === "user").map((m) => m.content))
      .filter((t) => t && t.length > 4)
      .slice(0, 6);
    if (priorUserMsgs.length > 0) {
      personaMemory = `\n\n## Prior conversations with this visitor (memory)\nThe visitor has chatted with you before. Their previous messages included:\n${priorUserMsgs.map(m => `- "${m.slice(0, 200)}"`).join("\n")}\n\nUse this to understand context (e.g. they were looking at a specific city or shoot type) but don't repeat questions you already know answers to. If their current question contradicts old context, trust the current.`;
    }
  }

  const photographers = await loadPhotographersForConcierge();
  // Detect language from FIRST user message — much more reliable than navigator.language
  // (visitor may be on /en page but writing in Russian).
  const firstUserMsg = messages.find((m) => m.role === "user")?.content || "";
  const detectedLang = detectLanguage(firstUserMsg) || language || "en";
  let systemPrompt = buildSystemPrompt(photographers, { language: detectedLang });
  // Hard-prefix per turn — prevents the model from drifting back to English mid-conversation
  systemPrompt += `\n\n## ACTIVE CONVERSATION LANGUAGE: ${detectedLang}\nEvery field you generate (reply_text, each match.reasoning, each location.reason) MUST be in this language. Do not switch.`;

  // Track which photographers were already shown in this chat so we don't repeat
  // them if the user asks for "more matches" / "different ones".
  const shownSlugs = new Set<string>();
  for (const m of messages) {
    const matches = (m as { action?: { type?: string; data?: { matches?: { slug: string }[] } } }).action?.data?.matches;
    if (Array.isArray(matches)) for (const x of matches) if (x.slug) shownSlugs.add(x.slug);
  }
  if (shownSlugs.size > 0) {
    systemPrompt += `\n\n## Already shown in this conversation\nDo NOT suggest these photographers again unless the user explicitly asks for them by name: ${Array.from(shownSlugs).join(", ")}\nIf the user asks for "more matches" / "different photographers" / "send more", rotate to UNUSED photographers from the list. Don't repeat.`;
  }
  systemPrompt += `\n\n## Diversity reminder\nWhen multiple photographers fit the criteria, vary your picks across requests — don't always default to top-rated. Lesser-known photographers covering the right city deserve visibility too.`;
  if (page_context) {
    systemPrompt += `\n\n## Current page context\n${page_context}\n\nUse this to make smart suggestions, but don't mention the URL itself in your reply.`;
  }
  if (personaMemory) {
    systemPrompt += personaMemory;
  }

  const oaiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: MODEL,
      messages: oaiMessages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_completion_tokens: 600,
    });
  } catch (err) {
    console.error("[concierge] openai error:", err);
    return NextResponse.json({ error: "AI temporarily unavailable" }, { status: 503 });
  }

  const choice = completion.choices[0];
  const msg = choice.message;
  const usage = completion.usage;
  const costUsd = usage
    ? (usage.prompt_tokens / 1_000_000) * COST_PER_1M_INPUT + (usage.completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT
    : 0;

  // Parse tool calls (matches or human handoff)
  let action: { type: string; data: Record<string, unknown> } | null = null;
  let matchedPhotogIds: string[] = [];

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0];
    if (tc.type === "function") {
      const args = JSON.parse(tc.function.arguments || "{}");
      if (tc.function.name === "show_matches") {
        const slugs: string[] = (args.matches || []).map((m: { slug: string }) => m.slug);
        const full = photographers.filter((p) => slugs.includes(p.slug));
        const reasoned = (args.matches || []).map((m: { slug: string; reasoning: string }) => {
          const p = photographers.find((x) => x.slug === m.slug);
          return p ? { ...p, reasoning: m.reasoning } : null;
        }).filter(Boolean);
        matchedPhotogIds = full.map((p) => p.id);
        action = {
          type: "show_matches",
          data: { matches: reasoned, reply_text: args.reply_text || "" },
        };
      } else if (tc.function.name === "show_locations") {
        // Hydrate location data for the cards. Use Unsplash CDN helper for
        // cover images (the static /images/locations/*.jpg files don't exist).
        const { locations: allLocations } = await import("@/lib/locations-data");
        const { locationImage } = await import("@/lib/unsplash-images");
        const items = (args.locations || []).map((l: { slug: string; reason: string }) => {
          const loc = allLocations.find((x) => x.slug === l.slug);
          if (!loc) return null;
          return {
            slug: loc.slug,
            name: loc.name,
            name_pt: loc.name_pt,
            name_de: loc.name_de,
            region: loc.region,
            cover_image: locationImage(loc.slug, "card") || loc.cover_image,
            reason: l.reason,
          };
        }).filter(Boolean);
        action = {
          type: "show_locations",
          data: { locations: items, reply_text: args.reply_text || "" },
        };
      } else if (tc.function.name === "request_human_match") {
        action = {
          type: "human_handoff",
          data: { reason: args.reason, summary: args.summary },
        };
      }
    }
  }

  // Reply text: tool's reply_text > content > fallback
  const replyText =
    (action?.data?.reply_text as string | undefined) ||
    msg.content ||
    "";

  // Persist chat in DB
  const newChatMessages = [
    ...messages,
    { role: "assistant" as const, content: replyText, action },
  ];

  let chatId = chat_id;
  if (chatId) {
    const updated = await queryOne<{ id: string }>(
      `UPDATE concierge_chats SET
         messages = $1::jsonb,
         email = COALESCE($2, email),
         first_name = COALESCE($3, first_name),
         language = COALESCE($4, language),
         total_tokens = total_tokens + $5,
         total_cost_usd = total_cost_usd + $6,
         matched_photographer_ids = CASE WHEN array_length($7::uuid[], 1) > 0 THEN $7 ELSE matched_photographer_ids END,
         outcome = COALESCE($8, outcome),
         updated_at = NOW()
       WHERE id = $9 RETURNING id`,
      [
        JSON.stringify(newChatMessages),
        email || null,
        first_name || null,
        language || null,
        usage?.total_tokens || 0,
        costUsd,
        matchedPhotogIds,
        action?.type === "human_handoff" ? "human_handoff" : action?.type === "show_matches" ? "matched" : null,
        chatId,
      ]
    ).catch((e) => { console.error("[concierge] update error:", e); return null; });
    if (!updated) chatId = undefined;
  }

  if (!chatId) {
    const utm = {
      source: req.cookies.get("utm_source")?.value || null,
      medium: req.cookies.get("utm_medium")?.value || null,
      campaign: req.cookies.get("utm_campaign")?.value || null,
      term: req.cookies.get("utm_term")?.value || null,
      gclid: req.cookies.get("gclid")?.value || null,
    };
    const created = await queryOne<{ id: string }>(
      `INSERT INTO concierge_chats (visitor_id, user_id, email, first_name, messages, matched_photographer_ids, outcome, language, total_tokens, total_cost_usd, utm_source, utm_medium, utm_campaign, utm_term, gclid, source, page_context)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
      [
        visitor_id || null,
        userId,
        email || null,
        first_name || null,
        JSON.stringify(newChatMessages),
        matchedPhotogIds,
        action?.type || null,
        language || null,
        usage?.total_tokens || 0,
        costUsd,
        utm.source, utm.medium, utm.campaign, utm.term, utm.gclid,
        source || "page",
        page_context || null,
      ]
    ).catch((e) => { console.error("[concierge] insert error:", e); return null; });
    chatId = created?.id;
  } else if (userId) {
    // Backfill user_id on existing chat if user logged in mid-conversation
    await queryOne(
      "UPDATE concierge_chats SET user_id = $1 WHERE id = $2 AND user_id IS NULL RETURNING id",
      [userId, chatId]
    ).catch(() => null);
  }

  return NextResponse.json({
    chat_id: chatId,
    reply: replyText,
    action,
    usage: usage ? { tokens: usage.total_tokens, cost_usd: Number(costUsd.toFixed(4)) } : null,
  });
}
