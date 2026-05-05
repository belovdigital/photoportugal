import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { query, queryOne } from "@/lib/db";
import { authFromRequest } from "@/lib/mobile-auth";
import { loadPhotographersForConcierge } from "@/lib/concierge/photographer-context";
import { buildSystemPrompt } from "@/lib/concierge/system-prompt";
import { computeBadges } from "@/lib/concierge/match-badges";
import { pageContextToPromptString, type PageContext } from "@/lib/concierge/page-context";
import { resolveIntent, rankTopCandidates, formatTopCandidatesBlock } from "@/lib/concierge/candidate-ranker";
import { checkPhotographersAvailability } from "@/lib/concierge/availability-check";
import { computeLeadScore } from "@/lib/concierge/lead-score";

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
      description: "Suggest 2-4 PUBLIC Portugal destination cards when the visitor is undecided WHERE to shoot. ONLY use slugs from this public-card list: lisbon, sintra, cascais, douro-valley, porto, algarve, lagos, faro, albufeira, tavira, madeira, comporta, caparica, setubal, arrabida, aveiro, guimaraes, coimbra, nazare, evora, obidos, ericeira, sesimbra, peniche, geres, funchal, ponta-delgada, azores, tomar. Do NOT use new coverage-only slugs such as lisbon-region, porto-north, azores-central-group, terceira, pico, faial, sao-miguel here because they do not have public cards yet. Use show_matches for confirmed coverage-only locations.",
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
                slug: { type: "string", description: "Public destination card slug (must be from the list above)" },
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
      description: "Show 1-3 photographer matches to the user. ONLY call this once the visitor has CONFIRMED ONE specific location (not 'one of these three'). The confirmed location may be a public city/region OR a new coverage node such as Terceira, Pico, Faial, Sao Miguel, Lisbon Region, Algarve, Madeira, or an Azores island group. Match using photographers' locations=[...] coverage slugs. Never call this in the same turn as show_locations. PREFER 3 matches when there are 3 strong fits, but send fewer if you'd otherwise be reaching — 1 perfect match is better than 3 with shoehorning. If you can only find 1, say so honestly in reply_text (e.g. \"I found one strong fit for São Jorge — let me know if you want to look at neighbouring islands too\").",
      parameters: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                slug: { type: "string", description: "The photographer's slug from the list" },
                reasoning: { type: "string", description: "1-2 sentences explaining why this photographer fits this specific visitor" },
                style_label: { type: "string", description: "Optional 1-3 word stylistic tag for this match — pick from the photographer's actual specialty as it relates to the visitor's request. Examples: 'Cinematic style', 'Best for families', 'Sunset specialist', 'Local Sintra expert', 'Natural & candid', 'Editorial vibes'. Max 24 characters. Skip if you can't say something specific." },
              },
              required: ["slug", "reasoning"],
            },
          },
          reply_text: { type: "string", description: "Friendly intro line to display above the cards, e.g. 'Based on what you said, here are 3 great matches:'" },
          target_date: {
            type: "string",
            description: "Optional. If the visitor mentioned a specific shoot date in the conversation, return it as ISO YYYY-MM-DD. Skip if no date was said or the visitor is still flexible. Examples: 'next Friday' → resolve to that Friday's ISO date based on today's date in the system message; 'June 15' → '2026-06-15' (use the visitor's likely year); '15/06/2026' → '2026-06-15'. Don't invent a date if they didn't say one.",
          },
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
  /** Action payload from previous assistant turns (show_matches /
   *  show_locations / human_handoff). The client passes this back so the
   *  server can dedupe photographers already shown and avoid suggesting
   *  the same locations twice. The action is NOT forwarded to OpenAI —
   *  only consumed by our own bookkeeping. */
  action?: {
    type?: string;
    data?: { matches?: { slug: string }[]; locations?: { slug: string }[] };
  } | null;
}

const coverageToPublicCardSlug: Record<string, string> = {
  "lisbon-region": "lisbon",
  "porto-north": "porto",
  "central-portugal": "coimbra",
  "azores-eastern-group": "azores",
  "azores-central-group": "azores",
  "azores-western-group": "azores",
  "sao-miguel": "azores",
  "santa-maria": "azores",
  terceira: "azores",
  graciosa: "azores",
  "sao-jorge": "azores",
  pico: "azores",
  faial: "azores",
  flores: "azores",
  corvo: "azores",
  portimao: "algarve",
  vilamoura: "algarve",
};

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
  const { chat_id, visitor_id, messages, email, first_name, language, source, page_context, page_context_obj } = body as {
    chat_id?: string;
    visitor_id?: string;
    messages: IncomingMessage[];
    email?: string;
    first_name?: string;
    language?: string;
    source?: "page" | "drawer";
    /** Legacy free-form context string (still accepted from the /concierge page). */
    page_context?: string;
    /** Structured page context from the drawer — preferred over page_context. */
    page_context_obj?: PageContext;
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
    // Resolve slug → name so the LLM sees who it has already recommended.
    // The OAI message stream strips action.data, so without this the model
    // only reads "here are your matches:" and can forget who it picked,
    // sometimes resetting the whole conversation when given garbage input.
    const shownLabels = Array.from(shownSlugs).map((slug) => {
      const p = photographers.find((x) => x.slug === slug);
      return p ? `${p.name} (${slug})` : slug;
    });
    systemPrompt += `\n\n## Already shown in this conversation\nYou ALREADY recommended these photographers earlier in this same chat — treat them as common ground with the visitor: ${shownLabels.join(", ")}\nDo NOT suggest them again unless the visitor asks by name. If the visitor asks for "more matches" / "different ones" / "send more", rotate to UNUSED photographers. Don't repeat.\n\n## Conversation continuity (CRITICAL)\nThis is an ongoing conversation. The visitor has already engaged. NEVER restart with a fresh greeting like "Hi! I'll find you 3 photographers" — they already saw matches. If the visitor's last message is short or unclear, ask a SHORT clarifying question that builds on what you already know, do NOT reset.`;
  }
  systemPrompt += `\n\n## Diversity reminder\nWhen multiple photographers fit the criteria, vary your picks across requests — don't always default to top-rated. Lesser-known photographers covering the right city deserve visibility too.`;
  // Today's date — needed so the AI can resolve relative timeframes like
  // "next Friday" or "in two weeks" into an ISO target_date for the
  // availability check on show_matches.
  const todayIso = new Date().toISOString().slice(0, 10);
  systemPrompt += `\n\n## Today's date\n${todayIso}\n\nUse this when resolving relative dates the visitor mentions (e.g. "next month", "in 2 weeks", "this Saturday"). When the visitor mentions ANY date or timeframe AND you're calling show_matches, include the resolved ISO date in target_date so the server can check the photographers' calendars and surface availability.`;
  // Structured context (drawer) takes precedence; legacy page_context string
  // is still accepted as a fallback from the /concierge page.
  let resolvedPageContext = page_context_obj
    ? pageContextToPromptString(page_context_obj)
    : page_context || null;

  // C4: when on a photographer profile, the AI needs to know WHO. Without
  // this, "compare with similar" or "tell me about their style" answers
  // are generic. Resolve the photographer server-side from the slug and
  // append their key facts to the page-context block so the model can
  // reference them by name and reason about peers.
  let viewedPhotographer: typeof photographers[number] | null = null;
  if (
    page_context_obj &&
    (page_context_obj.type === "photographer_profile" || page_context_obj.type === "booking_flow") &&
    page_context_obj.photographerSlug
  ) {
    viewedPhotographer = photographers.find((p) => p.slug === page_context_obj.photographerSlug) || null;
    if (viewedPhotographer && resolvedPageContext) {
      const v = viewedPhotographer;
      const locs = (v.locations || []).slice(0, 4).join(", ") || "Portugal";
      const types = (v.shoot_types || []).slice(0, 4).join(", ") || "general";
      const langs = (v.languages || []).slice(0, 4).join(", ") || "EN";
      const reviews = Number(v.review_count) > 0
        ? `${Number(v.rating).toFixed(1)}★ (${v.review_count} reviews)`
        : "no reviews yet";
      const price = v.min_price ? `from €${v.min_price}` : "price tbd";
      const tier = [
        v.is_featured ? "FEATURED" : null,
        v.is_verified ? "VERIFIED" : null,
        v.is_founding ? "FOUNDING" : null,
      ].filter(Boolean).join(", ") || "standard";
      resolvedPageContext += `\n\n## About this photographer\nName: ${v.name}\nSlug: ${v.slug}\nCovers: ${locs}\nSpecialties: ${types}\nLanguages: ${langs}\nReviews: ${reviews}\nPricing: ${price}\nTier: ${tier}\n\nWhen the visitor says "they", "this photographer", "their style", "are they available" — they mean ${v.name}. If they ask for "similar", "alternatives", "compare with others" — call show_matches with 2-3 PEERS who cover the same area but are NOT ${v.name}. If they ask about availability for a specific date, you only have date-availability for matches you call show_matches on (the system will check ${v.name} too if you include them). Do NOT include ${v.name} in show_matches when the visitor explicitly asks for alternatives.`;
    }
  }

  if (resolvedPageContext) {
    systemPrompt += `\n\n## Current page context\n${resolvedPageContext}\n\nIMPORTANT: any facts implied by the page context (location, occasion, photographer being viewed) should be treated as already confirmed by the user — do NOT re-ask. If location AND occasion are both implied, go straight to show_matches without a clarifying question. The user's explicit messages override the page context if they contradict it.\n\nDo not mention the URL itself in your reply.`;
  }

  // Server-side pre-ranking — when we can extract a clear intent (URL,
  // slug-hint, or occasion keyword), pre-compute the strongest fits by
  // hard criteria and inject as a "preferred pool" hint. The LLM still
  // sees the full photographer list and can pick anyone, but we nudge
  // toward the deterministic top-12 to avoid stylistic-only picks that
  // miss coverage / rating / tier signals.
  const intent = resolveIntent({ pageContext: page_context_obj || null, messages });
  // On a photographer profile with no other location signal yet, use
  // the photographer's primary coverage slug so peer ranking targets
  // their area (visitor implicitly cares about this region).
  if (!intent.locationSlug && viewedPhotographer && (viewedPhotographer.locations || [])[0]) {
    intent.locationSlug = viewedPhotographer.locations![0];
    intent.locationConfident = true;
  }
  // Exclude the currently-viewed photographer from peer ranking so
  // "compare with similar" returns alternatives, not them.
  const rankerExcludes = new Set(shownSlugs);
  if (viewedPhotographer) rankerExcludes.add(viewedPhotographer.slug);
  const topCandidates = rankTopCandidates({
    photographers,
    intent,
    topN: 12,
    excludeSlugs: rankerExcludes,
  });
  const topBlock = formatTopCandidatesBlock(topCandidates, intent);
  if (topBlock) systemPrompt += topBlock;
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

  // Normalised outcome enum used in both INSERT and UPDATE so analytics
  // group by the same values. Previously INSERT wrote tool names
  // ("show_matches"/"show_locations") while UPDATE wrote
  // "matched"/"human_handoff" — making chat-outcome reports unreliable.
  function outcomeFor(a: typeof action): string | null {
    if (!a) return null;
    if (a.type === "show_matches") return "matched";
    if (a.type === "show_locations") return "exploring_locations";
    if (a.type === "human_handoff") return "human_handoff";
    return a.type || null;
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0];
    if (tc.type === "function") {
      const args = JSON.parse(tc.function.arguments || "{}");
      if (tc.function.name === "show_matches") {
        const slugs: string[] = (args.matches || []).map((m: { slug: string }) => m.slug);
        const full = photographers.filter((p) => slugs.includes(p.slug));
        const reasoned = (args.matches || [])
          .map((m: { slug: string; reasoning: string; style_label?: string }, idx: number) => {
            const p = photographers.find((x) => x.slug === m.slug);
            if (!p) return null;
            return {
              ...p,
              reasoning: m.reasoning,
              style_label: typeof m.style_label === "string" ? m.style_label.slice(0, 24) : undefined,
              rank: idx,
            };
          })
          .filter(Boolean) as (typeof photographers[number] & { reasoning: string; style_label?: string; rank: number })[];

        // Server-side deterministic badges layered on top of the AI's
        // style_label. Each match gets up to 2 badges (best_match,
        // fastest_responder, most_reviews, best_value, featured).
        const badgesById = computeBadges(reasoned);

        // Availability check: if the AI extracted a target_date from the
        // conversation, query each photographer's calendar so the card
        // can render "Available May 18" / "Busy May 18" instead of
        // making the visitor click through to discover the conflict.
        let availabilityById: Map<string, { date: string; available: boolean; label: string }> = new Map();
        const targetDate = typeof args.target_date === "string" ? args.target_date : null;
        if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          try {
            availabilityById = await checkPhotographersAvailability(reasoned.map((m) => m.id), targetDate);
          } catch (err) {
            console.error("[concierge] availability check error:", err);
          }
        }

        const enriched = reasoned.map((m) => ({
          ...m,
          badges: badgesById.get(m.id) || [],
          availability: availabilityById.get(m.id) || null,
        }));

        matchedPhotogIds = full.map((p) => p.id);
        action = {
          type: "show_matches",
          data: { matches: enriched, reply_text: args.reply_text || "", target_date: targetDate },
        };
      } else if (tc.function.name === "show_locations") {
        // Hydrate location data for the cards. Use Unsplash CDN helper for
        // cover images (the static /images/locations/*.jpg files don't exist).
        const { locations: allLocations } = await import("@/lib/locations-data");
        const { locationImage } = await import("@/lib/unsplash-images");
        const seenPublicSlugs = new Set<string>();
        const items = (args.locations || []).map((l: { slug: string; reason: string }) => {
          const publicSlug = allLocations.some((x) => x.slug === l.slug)
            ? l.slug
            : coverageToPublicCardSlug[l.slug];
          if (!publicSlug || seenPublicSlugs.has(publicSlug)) return null;
          seenPublicSlugs.add(publicSlug);
          const loc = allLocations.find((x) => x.slug === publicSlug);
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
        outcomeFor(action),
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
    // Cookie-based UTM can be empty when the visitor opens the drawer
    // many minutes after landing (some cookies expire, ad blockers, etc).
    // If we have a gclid in cookies, look up the original ad_visits row
    // for that click to recover utm_term/source/etc. Fills missing fields
    // only — cookie values always win when both exist.
    if (utm.gclid && (!utm.source || !utm.term)) {
      try {
        const original = await queryOne<{
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_term: string | null;
        }>(
          `SELECT utm_source, utm_medium, utm_campaign, utm_term
             FROM ad_visits
             WHERE gclid = $1
             ORDER BY created_at ASC
             LIMIT 1`,
          [utm.gclid]
        );
        if (original) {
          utm.source ??= original.utm_source;
          utm.medium ??= original.utm_medium;
          utm.campaign ??= original.utm_campaign;
          utm.term ??= original.utm_term;
        }
      } catch (err) {
        console.error("[concierge] ad_visits utm fallback error:", err);
      }
    }
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
        outcomeFor(action),
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

  // Forward terminal-event chats to admins in Telegram (new "ИИ Консьерж"
  // topic). Fires once the AI either shows matches OR escalates to a
  // human; subsequent show_matches in the same chat are deduped via the
  // shownSlugs heuristic — admin sees the freshest snapshot. Fire-and-
  // forget so a Telegram outage never blocks the chat response.
  if (action && (action.type === "show_matches" || action.type === "human_handoff")) {
    void notifyConciergeAdmins({
      chatId,
      messages: newChatMessages,
      action,
      photographers,
      email,
      first_name,
      detectedLang,
      visitorId: visitor_id || null,
      pageContextStr: resolvedPageContext,
    }).catch((e) => console.error("[concierge] telegram notify error:", e));
  }

  return NextResponse.json({
    chat_id: chatId,
    reply: replyText,
    action,
    usage: usage ? { tokens: usage.total_tokens, cost_usd: Number(costUsd.toFixed(4)) } : null,
  });
}

async function notifyConciergeAdmins(opts: {
  chatId: string | undefined;
  messages: { role: string; content: string; action?: { type?: string; data?: { matches?: { slug: string; reasoning?: string }[]; summary?: string } } | null }[];
  action: { type: string; data: Record<string, unknown> };
  photographers: { slug: string; name: string }[];
  email?: string | null;
  first_name?: string | null;
  detectedLang: string;
  visitorId: string | null;
  pageContextStr: string | null;
}): Promise<void> {
  const { sendTelegram } = await import("@/lib/telegram");

  // Pull current chat row so we have phone (might have been captured via
  // a separate WA flow), outcome, traffic source, recency — needed for
  // a real lead-heat score in the Telegram message.
  let phone: string | null = null;
  let leadHeatBadge: string | null = null;
  if (opts.chatId) {
    const row = await queryOne<{
      phone: string | null; gclid: string | null; utm_source: string | null;
      outcome: string | null; matched_photographer_ids: string[] | null;
      inquiry_booking_ids: string[] | null;
      created_at: string; updated_at: string;
    }>(
      `SELECT phone, gclid, utm_source, outcome, matched_photographer_ids,
              inquiry_booking_ids, created_at, updated_at
         FROM concierge_chats WHERE id = $1`,
      [opts.chatId]
    ).catch(() => null);
    if (row) {
      phone = row.phone;
      const ls = computeLeadScore({
        email: opts.email || null,
        phone: row.phone,
        gclid: row.gclid,
        utm_source: row.utm_source,
        outcome: row.outcome,
        matched_photographer_ids: row.matched_photographer_ids,
        inquiry_booking_ids: row.inquiry_booking_ids,
        messages: opts.messages || [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      leadHeatBadge = ls.heat === "hot" ? `🔥 HOT ${ls.score}` : ls.heat === "warm" ? `🟡 WARM ${ls.score}` : `🔵 ${ls.score}`;
    }
  }

  const lines: string[] = [];
  const headerText = opts.action.type === "human_handoff"
    ? "🆘 <b>Concierge: human handoff requested</b>"
    : "⭐ <b>Concierge: matches shown</b>";
  lines.push(leadHeatBadge ? `${headerText} · ${leadHeatBadge}` : headerText);

  const meta: string[] = [];
  if (opts.first_name) meta.push(`👤 ${escapeHtml(opts.first_name)}`);
  if (opts.email) meta.push(`✉️ ${escapeHtml(opts.email)}`);
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    meta.push(digits.length >= 6
      ? `<a href="https://wa.me/${digits}?text=${encodeURIComponent("Hi! This is Photo Portugal — about your photoshoot inquiry.")}">📱 ${escapeHtml(phone)}</a>`
      : `📱 ${escapeHtml(phone)}`);
  }
  if (opts.detectedLang) meta.push(`🌐 ${opts.detectedLang}`);
  if (opts.visitorId) meta.push(`<code>${opts.visitorId.slice(0, 8)}</code>`);
  if (meta.length) lines.push(meta.join("  ·  "));
  if (opts.pageContextStr) lines.push(`<i>${opts.pageContextStr.replace(/<[^>]+>/g, "").slice(0, 200)}</i>`);

  const userMsgs = opts.messages.filter((m) => m.role === "user").slice(-5);
  if (userMsgs.length) {
    lines.push("");
    lines.push("<b>Last user messages:</b>");
    for (const m of userMsgs) {
      const text = (m.content || "").replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, "").slice(0, 200);
      lines.push(`• ${escapeHtml(text)}`);
    }
  }

  if (opts.action.type === "show_matches") {
    const matches = (opts.action.data?.matches as { slug: string; reasoning?: string }[] | undefined) || [];
    if (matches.length) {
      lines.push("");
      lines.push("<b>Recommended:</b>");
      for (const m of matches) {
        const p = opts.photographers.find((x) => x.slug === m.slug);
        const name = p?.name || m.slug;
        lines.push(`• <b>${escapeHtml(name)}</b> (<a href="https://photoportugal.com/photographers/${m.slug}">${escapeHtml(m.slug)}</a>)`);
        if (m.reasoning) lines.push(`  <i>${escapeHtml(m.reasoning.slice(0, 220))}</i>`);
      }
    }
  } else if (opts.action.type === "human_handoff") {
    const summary = (opts.action.data?.summary as string | undefined) || "";
    if (summary) {
      lines.push("");
      lines.push(`<b>Summary:</b> ${escapeHtml(summary)}`);
    }
  }

  if (opts.chatId) {
    lines.push("");
    lines.push(`<a href="https://photoportugal.com/admin?tab=concierge&chat=${opts.chatId}">Open in admin →</a>`);
  }

  await sendTelegram(lines.join("\n"), "concierge");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
