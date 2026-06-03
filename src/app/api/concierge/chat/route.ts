import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { query, queryOne } from "@/lib/db";
import { authFromRequest } from "@/lib/mobile-auth";
import { loadPhotographersForConcierge } from "@/lib/concierge/photographer-context";
import { buildSystemPrompt } from "@/lib/concierge/system-prompt";
import { computeBadges } from "@/lib/concierge/match-badges";
import { pageContextToPromptString, type PageContext } from "@/lib/concierge/page-context";
import { resolveIntent, rankTopCandidates, formatTopCandidatesBlock, extractStructuredSignals, type RankedCandidate } from "@/lib/concierge/candidate-ranker";
import { checkPhotographersAvailability } from "@/lib/concierge/availability-check";
import { classifyTrafficSegment, logRecommendations, type RecommendationSnapshot, type RecommendationStrategy } from "@/lib/concierge/recommendation-events";
import { computeLeadScore } from "@/lib/concierge/lead-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// gpt-5.4 (full, not mini) pricing per 1M tokens (April 2026). Concierge
// is the platform's single biggest lead-quality lever — it's the first
// human-ish conversation the visitor has with us. We want it strictly
// better than chatting with a knowledgeable friend: better context
// retention, deeper empathy, no rushing to recommendations, no drift
// between turns. The 4x cost vs mini is worth it — a single saved lead
// pays for thousands of chat round-trips.
const COST_PER_1M_INPUT = 3.00;
const COST_PER_1M_OUTPUT = 12.00;
const MODEL = "gpt-5.4";

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
      name: "show_spots",
      description: "Render rich cards for specific photoshoot SPOTS (landmarks, beaches, viewpoints, neighborhoods) within Portuguese cities. Use when the visitor's intent points to specific places (e.g. 'fairytale castle', 'sea cave', 'tile-faced lanes'), or when they've just picked a city and you want to show standout shoot locations within it. Each card links to /spots/<city>/<slug> with photos, description, map, and photographers covering the area. Pass 1-4 spot pairs. Use ONLY slugs from the catalog in the system prompt — never invent. Don't combine with show_matches in the same turn; spots come first when location is broad, matches come when both location AND shoot-type are clear.",
      parameters: {
        type: "object",
        properties: {
          spots: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                city: { type: "string", description: "City slug as keyed in the spot catalog (e.g. 'sintra', 'lisbon', 'algarve')." },
                slug: { type: "string", description: "Spot slug exactly as listed in the catalog (e.g. 'pena-palace', 'benagil-cave')." },
                reason: { type: "string", description: "1 sentence on why this spot fits the visitor's intent — max 140 chars." },
              },
              required: ["city", "slug", "reason"],
            },
          },
          reply_text: { type: "string", description: "Short intro line above the spot cards, e.g. 'Three Sintra spots that match a fairytale vibe:'" },
        },
        required: ["spots", "reply_text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "offer_blind_booking",
      description: "Propose an immediate fixed-price 'we book one for you' offer when you know region (city/island slug), date (ISO YYYY-MM-DD), occasion (shoot type slug), and party_size. Use INSTEAD OF show_matches when those four are present and the visitor has NOT previously declined a blind offer in this chat. The server fetches the price — NEVER quote a EUR amount in reply_text. NEVER use the phrases 'either way' or 'no pressure'. If the visitor declines (says 'no', 'show options', etc.), your VERY NEXT turn MUST call show_matches with normal candidates for the same region/date/occasion.",
      parameters: {
        type: "object",
        properties: {
          region: { type: "string", description: "Region/city/island slug (e.g. lisbon, sintra, madeira, algarve, porto, azores, ponta-delgada)." },
          date: { type: "string", description: "ISO YYYY-MM-DD shoot date. Required — do not call without a concrete date." },
          occasion: { type: "string", description: "Shoot type slug: couples, family, solo, proposal, honeymoon, engagement, elopement, maternity, anniversary, birthday, vacation, other." },
          party_size: { type: "integer", minimum: 1, maximum: 30, description: "Number of people in the shoot. Required." },
          duration_minutes: { type: "integer", minimum: 60, maximum: 180, description: "Session duration in minutes. Choose 60, 120, or 180 based on visitor context — never guess if they said nothing." },
          reply_text: { type: "string", description: "Short confident intro line above the offer card. NEVER mention EUR amounts, never use 'either way' or 'no pressure'. Example: 'Got everything I need — I can lock this in for you with one of our verified photographers. Want me to take care of it?'" },
        },
        required: ["region", "date", "occasion", "party_size", "duration_minutes", "reply_text"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_human_match",
      description: "Use this only as fallback when you genuinely cannot match (location with no photographers, weird request, etc). A human will follow up within 4h. CRITICAL: BEFORE calling this tool, you MUST first ask the visitor for an email in a previous turn so our team can reach them. Pass that email in `contact_email`. If the visitor explicitly refuses to share contact info, you may still call this but set `contact_refused: true` so we know.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why automated matching doesn't fit this case" },
          summary: { type: "string", description: "Short summary of what the visitor wants for the human to act on" },
          contact_email: { type: "string", description: "Visitor's email if shared in conversation. Required unless contact_refused=true." },
          contact_phone: { type: "string", description: "Optional. Visitor's phone (WhatsApp) if shared in conversation." },
          contact_refused: { type: "boolean", description: "Set to true ONLY if the visitor explicitly refused to share contact info after you asked." },
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

// Script-based fast path for non-Latin alphabets — these are unambiguous,
// free, and don't need an LLM round-trip.
function detectScriptLanguage(text: string): string | null {
  if (!text || text.trim().length < 2) return null;
  const s = text.trim();
  if (/[А-Яа-яЁё]/.test(s)) return "ru";
  if (/[֐-׿]/.test(s)) return "he";
  if (/[一-鿿]/.test(s)) return "zh";
  if (/[぀-ゟ゠-ヿ]/.test(s)) return "ja";
  if (/[؀-ۿ]/.test(s)) return "ar";
  return null;
}

// Ask OpenAI to classify the language. Falls back to `en` on any failure.
// Cheap: ~50-100 input tokens, 2 output tokens. ~$0.0001 per call.
async function detectLanguageViaAI(openai: OpenAI, text: string): Promise<string | null> {
  if (!text || text.trim().length < 2) return null;
  const scriptHit = detectScriptLanguage(text);
  if (scriptHit) return scriptHit;
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_completion_tokens: 4,
      messages: [
        {
          role: "system",
          content: "You are a language identification engine. Reply with the ISO 639-1 two-letter code of the user message — nothing else, no punctuation, no quotes. Examples: en, pt, de, es, fr, ru, it, nl. If you genuinely cannot tell, reply en.",
        },
        { role: "user", content: text.slice(0, 500) },
      ],
    });
    const raw = (res.choices[0]?.message?.content || "").trim().toLowerCase();
    const code = raw.match(/^[a-z]{2}$/)?.[0];
    return code || null;
  } catch (err) {
    console.warn("[concierge] language detect via AI failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  // Anti-abuse rate limit. Each LLM call costs real money (gpt-4o-mini
  // ~$0.005 per round-trip with our prompt size), so a bot loop could
  // burn through OpenAI budget fast. Bucket per visitor_id when present
  // (lets a single human keep typing), else fall back to IP. Generous
  // enough that a human pasting + retrying doesn't hit it, tight enough
  // that an attacker can't sustain meaningful spend.
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "anonymous";
  // Peek visitor_id early without re-parsing whole body twice.
  const rawBody = await req.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(rawBody); } catch {}
  const bucketKey = `concierge:${(parsed as { visitor_id?: string }).visitor_id || ip}`;
  if (!checkRateLimit(bucketKey, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Slow down for a minute and try again." },
      { status: 429 }
    );
  }
  // Additional IP-level cap so a fleet of fake visitor_ids from one box
  // can't bypass the per-visitor bucket.
  if (!checkRateLimit(`concierge:ip:${ip}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests from this network." },
      { status: 429 }
    );
  }

  const body = parsed;
  const { chat_id, visitor_id, messages, email, first_name, language, source, page_context, page_context_obj, source_chip, attribution } = body as {
    chat_id?: string;
    visitor_id?: string;
    messages: IncomingMessage[];
    email?: string;
    first_name?: string;
    language?: string;
    source?: "page" | "drawer";
    attribution?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_term?: string;
      gclid?: string;
    };
    /** Legacy free-form context string (still accepted from the /concierge page). */
    page_context?: string;
    /** Structured page context from the drawer — preferred over page_context. */
    page_context_obj?: PageContext;
    /** Verbatim chip text if the chat started via a chip click (analytics).
     *  Only meaningful on chat creation; ignored on subsequent turns. */
    source_chip?: string;
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
  // Detect language from BOTH the first user message AND the latest one.
  // The first establishes a default; the latest catches mid-chat switches
  // ("na verdade prefiro responder em português", or a sudden full PT
  // sentence after EN turns). The previous logic locked detectedLang to
  // the first message and ignored real explicit switch signals.
  const userMsgs = messages.filter((m) => m.role === "user");
  const firstUserMsg = userMsgs[0]?.content || "";
  const latestUserMsg = userMsgs[userMsgs.length - 1]?.content || firstUserMsg;
  const firstLang =
    detectScriptLanguage(firstUserMsg)
    || (await detectLanguageViaAI(openai, firstUserMsg))
    || language
    || "en";
  // Re-detect on the LATEST message only when it's long enough to be
  // confident (>= 6 words). Short replies ("ok", "yes") or one-word
  // location tokens shouldn't flip language.
  const latestWordCount = latestUserMsg.trim().split(/\s+/).length;
  let latestLang: string | null = null;
  if (latestUserMsg !== firstUserMsg && latestWordCount >= 6) {
    latestLang =
      detectScriptLanguage(latestUserMsg)
      || (await detectLanguageViaAI(openai, latestUserMsg));
  }
  // Explicit switch detection — short messages like "in PT please",
  // "responde em português" should override even at low word count.
  const switchRegex = /\b(in|en|em|на|auf)\s+(english|inglés|inglês|englisch|anglais|portuguese|portugu[eê]s|português|portugiesisch|portugais|spanish|espa[ñn]ol|espanhol|spanisch|french|francés|francês|französisch|français|german|alem[aã]n|alem[aã]o|deutsch|allemand|russian|русск|russisch|russo|русский)\b|prefiro\s+responder|switch\s+to\s+(en|pt|es|fr|de|ru)|по[\s-]?русски\s*пожалуйста|auf\s+deutsch\s+bitte|en\s+espa[ñn]ol\s+por\s+favor|en\s+fran[çc]ais/i;
  let explicitSwitchLang: string | null = null;
  if (switchRegex.test(latestUserMsg)) {
    // Use the script of the request itself as a strong signal, fall
    // back to AI classification of the request.
    explicitSwitchLang =
      detectScriptLanguage(latestUserMsg)
      || await detectLanguageViaAI(openai, latestUserMsg);
  }
  const detectedLang = explicitSwitchLang || latestLang || firstLang || "en";
  let systemPrompt = buildSystemPrompt(photographers, { language: detectedLang });
  // Per-turn language anchor. We say "stay in X unless visitor asks
  // otherwise" instead of the old absolute "do not switch", because the
  // detection above already gave us the latest-truth lang.
  systemPrompt += `\n\n## ACTIVE CONVERSATION LANGUAGE: ${detectedLang}\nEvery field you generate (reply_text, each match.reasoning, each location.reason) MUST be in this language. If the visitor's LATEST message is in a different language or explicitly asks to switch, the detection above has already updated this value — just follow it. Open the reply with a 1-line acknowledgement in the new language ("Claro! Vou continuar em português" etc.) if this turn switched.`;

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

  // Session capture state — keys the "Email capture after show_matches"
  // rule. If the visitor has already given us an email (either via the
  // current request body OR previously persisted on the chat row), the
  // LLM is instructed NOT to ask again.
  let emailOnFile = !!email;
  if (!emailOnFile && chat_id) {
    try {
      const persisted = await queryOne<{ email: string | null }>(
        "SELECT email FROM concierge_chats WHERE id = $1",
        [chat_id]
      );
      emailOnFile = !!(persisted?.email);
    } catch {}
  }
  systemPrompt += `\n\n## Session capture state\nemail_on_file: ${emailOnFile}`;

  // Today's date — needed so the AI can resolve relative timeframes like
  // "next Friday" or "in two weeks" into an ISO target_date for the
  // availability check on show_matches.
  const todayIso = new Date().toISOString().slice(0, 10);
  systemPrompt += `\n\n## Today's date\n${todayIso}\n\nUse this when resolving relative dates the visitor mentions (e.g. "next month", "in 2 weeks", "this Saturday"). When the visitor mentions ANY date or timeframe AND you're calling show_matches, include the resolved ISO date in target_date so the server can check the photographers' calendars and surface availability.`;
  // Server-side enrichment: for blog pages the drawer only sends the
  // slug — we look up the post's derived topic (location + shoot type)
  // here so the prompt can mention "you're reading about Algarve photo
  // spots" instead of generic "you may be inspired by this".
  if (page_context_obj?.type === "blog" && page_context_obj.blogSlug && !page_context_obj.blogTopic) {
    try {
      const post = await queryOne<{ title: string; meta_title: string | null; target_keywords: string | null; excerpt: string | null; content: string | null; slug: string }>(
        "SELECT slug, title, meta_title, target_keywords, excerpt, content FROM blog_posts WHERE slug = $1 AND is_published = TRUE LIMIT 1",
        [page_context_obj.blogSlug]
      );
      if (post) {
        const { deriveBlogTopic } = await import("@/lib/blog-topic");
        const topic = deriveBlogTopic({
          slug: post.slug,
          title: post.title,
          target_keywords: post.target_keywords,
          excerpt: post.excerpt,
          content: post.content,
        });
        page_context_obj.blogTopic = {
          locationSlug: topic.primaryLocation?.slug,
          locationName: topic.primaryLocation?.name,
          shootTypeSlug: topic.primaryShootType?.slug,
          shootTypeName: topic.primaryShootType?.name,
        };
      }
    } catch (err) {
      console.error("[concierge] blog topic enrichment failed:", err);
    }
  }

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
  // Layer in budget/group size signals so the ranker can do basic
  // affordability/family-size weighting. Pure regex extraction — when
  // it finds nothing, the ranker behaves as before.
  const structured = extractStructuredSignals(messages);
  intent.budgetEur = structured.budgetEur;
  intent.groupSize = structured.groupSize;
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

  // Per-segment exploration ε. Paid ads = conservative (15%), organic
  // = generous (30%), returning user = most generous (40%). See
  // EPSILON_BY_SEGMENT in recommendation-events.ts for the rationale.
  // `utm` is built later in this handler so we derive directly from the
  // attribution body + cookies here.
  const earlyGclid = (attribution?.gclid && attribution.gclid.trim()) || req.cookies.get("gclid")?.value || null;
  const earlyUtmSource = (attribution?.utm_source && attribution.utm_source.trim()) || req.cookies.get("utm_source")?.value || null;
  const earlyUtmMedium = (attribution?.utm_medium && attribution.utm_medium.trim()) || req.cookies.get("utm_medium")?.value || null;
  const trafficSegment = classifyTrafficSegment({
    gclid: earlyGclid,
    utm_source: earlyUtmSource,
    utm_medium: earlyUtmMedium,
    userId,
  });
  const { EPSILON_BY_SEGMENT } = await import("@/lib/concierge/recommendation-events");
  const epsilon = EPSILON_BY_SEGMENT[trafficSegment];

  // Least-recently-shown rotation for newcomers: pull the set of
  // newcomer slugs surfaced as `fresh_fit` in the last 7 days and pass
  // it to the ranker so it prefers names that haven't been shown
  // recently. Without this the same 3 names took ~70% of fresh_fit picks
  // (Maya, Cindy, Aleksandra) while ~17 newcomer photographers never
  // appeared in concierge at all. Best-effort — failures don't break
  // ranking, just fall back to the legacy "pick from full pool" behaviour.
  let recentlyShownNewcomers: Set<string> | undefined;
  try {
    const rows = await query<{ slug: string }>(
      `SELECT DISTINCT pp.slug
         FROM concierge_recommendation_events e
         JOIN photographer_profiles pp ON pp.id = e.photographer_id
        WHERE e.strategy = 'fresh_fit'
          AND e.shown_at > NOW() - INTERVAL '7 days'`
    );
    if (rows.length > 0) recentlyShownNewcomers = new Set(rows.map((r) => r.slug));
  } catch (err) {
    console.warn("[concierge] recently-shown newcomers query failed:", err);
  }

  const rankedCandidates: RankedCandidate[] = rankTopCandidates({
    photographers,
    intent,
    topN: 12,
    excludeSlugs: rankerExcludes,
    epsilon,
    recentlyShownNewcomers,
  });
  const topCandidates = rankedCandidates.map((r) => r.photographer);
  // Build a slug→strategy/fitScore map so the show_matches branch can
  // tag each picked photographer with the ranker's classification
  // instead of falling back to "llm_pick".
  const strategyBySlug = new Map<string, { strategy: RankedCandidate["strategy"]; score: number }>();
  for (const rc of rankedCandidates) {
    strategyBySlug.set(rc.photographer.slug, { strategy: rc.strategy, score: rc.score });
  }

  const topBlock = formatTopCandidatesBlock(rankedCandidates, intent);
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

  let choice = completion.choices[0];
  let msg = choice.message;
  let usage = completion.usage;

  // Hard language guarantee: after the first response, verify it's
  // actually in `detectedLang`. Soft prompt rules occasionally fail
  // (especially on short/edge inputs), so one server-side retry with
  // an explicit "you replied in WRONG lang, redo in RIGHT lang" notice
  // catches the long tail. Cost: one extra LLM call ONLY when drift
  // detected (rare). Worth it for trust.
  //
  // We sample the response text from BOTH msg.content and any
  // reply_text inside a tool call, since the model puts content in
  // either depending on flow.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractReplyText(message: any): string {
    let txt = (message.content || "").trim();
    if (txt.length >= 20) return txt;
    // Pull reply_text from the first tool call's arguments JSON if present.
    const tcArgs = message?.tool_calls?.[0]?.function?.arguments;
    if (tcArgs) {
      try {
        const parsed = JSON.parse(tcArgs);
        if (typeof parsed.reply_text === "string") {
          txt = txt + " " + parsed.reply_text;
        }
      } catch {}
    }
    return txt.trim();
  }

  const firstReplyText = extractReplyText(msg);
  const responseLang = firstReplyText.length >= 30
    ? (detectScriptLanguage(firstReplyText) || await detectLanguageViaAI(openai, firstReplyText))
    : null;
  const wantsLang = detectedLang;
  if (
    responseLang &&
    wantsLang &&
    responseLang !== wantsLang
  ) {
    console.warn(`[concierge] language drift: wanted ${wantsLang}, got ${responseLang}. Retrying with stricter guard.`);
    const stricterMessages = [
      ...oaiMessages,
      {
        role: "system" as const,
        content: `CRITICAL LANGUAGE OVERRIDE: Your previous reply was written in ${responseLang.toUpperCase()}. The conversation language is **${wantsLang.toUpperCase()}**. The visitor wrote in ${wantsLang.toUpperCase()}. Regenerate your response with EVERY WORD in ${wantsLang.toUpperCase()}. Do not translate awkwardly — write naturally as a native ${wantsLang.toUpperCase()} speaker. No exception.`,
      },
    ];
    try {
      const retry = await openai.chat.completions.create({
        model: MODEL,
        messages: stricterMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.3, // lower temp = more rule-following on retry
        max_completion_tokens: 600,
      });
      const retryChoice = retry.choices[0];
      const retryReplyText = extractReplyText(retryChoice.message);
      const retryLang = retryReplyText.length >= 30
        ? (detectScriptLanguage(retryReplyText) || await detectLanguageViaAI(openai, retryReplyText))
        : null;
      // Accept retry if it matches OR is at least better-looking
      // (close enough). If retry still in wrong language, log and
      // keep the first response — failing loudly is worse than
      // shipping a slightly off-language reply.
      if (!retryLang || retryLang === wantsLang) {
        choice = retryChoice;
        msg = retryChoice.message;
        if (retry.usage) {
          usage = {
            prompt_tokens: (usage?.prompt_tokens || 0) + retry.usage.prompt_tokens,
            completion_tokens: (usage?.completion_tokens || 0) + retry.usage.completion_tokens,
            total_tokens: (usage?.total_tokens || 0) + retry.usage.total_tokens,
          };
        }
      } else {
        console.warn(`[concierge] retry still in ${retryLang}; keeping first response`);
      }
    } catch (err) {
      console.error("[concierge] language retry error:", err);
    }
  }
  const costUsd = usage
    ? (usage.prompt_tokens / 1_000_000) * COST_PER_1M_INPUT + (usage.completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT
    : 0;

  // Parse tool calls (matches or human handoff)
  let action: { type: string; data: Record<string, unknown> } | null = null;
  let matchedPhotogIds: string[] = [];
  // Per-photographer snapshots for analytics — filled inside the
  // show_matches branch, flushed after the chat row is persisted (so we
  // have a stable chat_id to FK against).
  let recommendationSnapshots: RecommendationSnapshot[] = [];

  // Normalised outcome enum used in both INSERT and UPDATE so analytics
  // group by the same values. Previously INSERT wrote tool names
  // ("show_matches"/"show_locations") while UPDATE wrote
  // "matched"/"human_handoff" — making chat-outcome reports unreliable.
  function outcomeFor(a: typeof action): string | null {
    if (!a) return null;
    if (a.type === "show_matches") return "matched";
    if (a.type === "show_locations") return "exploring_locations";
    if (a.type === "show_spots") return "exploring_locations";
    if (a.type === "human_handoff") return "human_handoff";
    if (a.type === "offer_blind_booking") return "blind_booking_offered";
    return a.type || null;
  }

  // When show_matches is called with empty matches AND the ranker can't
  // fill in a fallback, we drop the action and override the LLM's
  // misleading "here are some options" with a real apology. Initialized
  // here so the apology path further down can write into it.
  let emptyMatchesApology: string | null = null;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0];
    if (tc.type === "function") {
      const args = JSON.parse(tc.function.arguments || "{}");
      if (tc.function.name === "show_matches") {
        // Confidence guard — log when the LLM calls show_matches with
        // no inferable intent (no location, no occasion, no page
        // context, no slug hint). This isn't a hard reject yet because
        // there's a long tail of valid "the user knows what they want
        // even though the regex missed it" cases. Soft logging so we
        // can quantify how often it happens before tightening.
        if (!intent.locationSlug && !intent.occasionSlug && !page_context_obj?.photographerSlug && messages.length <= 2) {
          console.warn(
            "[concierge] show_matches called with low-confidence intent",
            { chatId: chat_id, msgCount: messages.length, slugs: (args.matches || []).map((m: { slug: string }) => m.slug) }
          );
        }
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

        // Empty- or thin-matches guard: the LLM sometimes calls
        // show_matches with too few picks — either 0 (judged nobody fit
        // the visitor's budget/criteria) or 1-2 (gave up on variety
        // because of a narrow filter the model invented). Pad up to 3
        // from the deterministic ranker, skipping anyone already
        // picked, so the visitor always has comparison options.
        const MIN_MATCHES = 3;
        let usedRankerFallback = false;
        const llmMatchCount = enriched.length;
        if (enriched.length < MIN_MATCHES && topCandidates.length > enriched.length) {
          const existingIds = new Set(enriched.map((m) => m.id));
          const filler = topCandidates
            .filter((p) => !existingIds.has(p.id))
            .slice(0, MIN_MATCHES - enriched.length)
            .map((p, idx) => ({
              ...p,
              reasoning: "",
              style_label: undefined,
              rank: enriched.length + idx,
            })) as (typeof photographers[number] & { reasoning: string; style_label?: string; rank: number })[];
          if (filler.length > 0) {
            const fbBadges = computeBadges(filler);
            let fbAvail: Map<string, { date: string; available: boolean; label: string }> = new Map();
            if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
              try {
                fbAvail = await checkPhotographersAvailability(filler.map((m) => m.id), targetDate);
              } catch {}
            }
            enriched.push(
              ...filler.map((m) => ({
                ...m,
                badges: fbBadges.get(m.id) || [],
                availability: fbAvail.get(m.id) || null,
              }))
            );
            full.push(...topCandidates.filter((p) => !existingIds.has(p.id)).slice(0, filler.length));
            // Only rewrite reply_text when the LLM gave us NOTHING and
            // every card is ranker-sourced — padding 1→3 or 2→3 keeps
            // the model's own framing because at least one of its picks
            // is in there.
            if (llmMatchCount === 0) {
              usedRankerFallback = true;
            }
            console.warn(
              "[concierge] show_matches: padded matches from ranker",
              { chatId: chat_id, llmCount: llmMatchCount, padded: filler.map((m) => m.slug) }
            );
          }
        }
        // Honest framing when we substituted the LLM's empty picks with
        // the ranker. Don't pretend they perfectly match the visitor's
        // criteria — they may be over budget / different style.
        if (usedRankerFallback) {
          args.reply_text = detectedLang === "es"
            ? "No encontré coincidencias exactas con tus criterios — aquí están los fotógrafos disponibles más cercanos a tu presupuesto, todos aceptando nuevas reservas:"
            : detectedLang === "pt"
              ? "Não encontrei correspondências exatas com os teus critérios — aqui estão os fotógrafos disponíveis mais próximos do teu orçamento, todos a aceitar novas reservas:"
              : detectedLang === "de"
                ? "Ich konnte keine exakte Übereinstimmung mit deinen Kriterien finden — hier sind die nächstgelegenen verfügbaren Fotografen zu deinem Budget, alle nehmen neue Buchungen an:"
                : detectedLang === "fr"
                  ? "Je n'ai pas trouvé de correspondance exacte avec tes critères — voici les photographes disponibles les plus proches de ton budget, tous acceptent de nouvelles réservations :"
                  : "I couldn't find an exact match for your criteria — here are the closest available photographers to your budget, all accepting new bookings:";
        }
        matchedPhotogIds = full.map((p) => p.id);

        // Snapshot what we just surfaced for analytics. Strategy comes
        // from the ranker (best_fit / fresh_fit / featured_fit /
        // local_fit). If the LLM picked a photographer the ranker
        // didn't surface (rare — usually means style override), we fall
        // back to "llm_pick" so we can spot those cases in analytics.
        recommendationSnapshots = enriched.map((m, idx) => {
          const rankerTag = strategyBySlug.get(m.slug);
          return {
            photographerId: m.id,
            rank: idx,
            strategy: (rankerTag?.strategy as RecommendationStrategy | undefined) || "llm_pick",
            fitScore: rankerTag?.score ?? null,
            sessionCountAtTime: ((m as { session_count?: number }).session_count) ?? null,
            reviewCountAtTime: m.review_count ?? null,
            isFeaturedAtTime: m.is_featured ?? null,
            isVerifiedAtTime: m.is_verified ?? null,
          };
        });

        if (enriched.length === 0) {
          // Even the ranker had nothing — drop the action entirely so the
          // UI doesn't render "here are some options:" followed by a blank
          // space. Override the reply text further down if the model
          // claimed cards exist.
          console.warn("[concierge] show_matches: no enriched matches even after fallback — dropping action", { chatId: chat_id });
          action = null;
          if (args.reply_text && /aquí tienes|here are|here's|voici|ecco|вот|tem aqui|aqui tens/i.test(args.reply_text)) {
            emptyMatchesApology = detectedLang === "es" ? "No encontré coincidencias exactas con esos criterios. ¿Podemos ampliar el presupuesto o flexibilizar la fecha o el lugar?"
              : detectedLang === "pt" ? "Não encontrei correspondências exatas com esses critérios. Podemos alargar o orçamento ou flexibilizar a data/local?"
              : detectedLang === "de" ? "Ich konnte mit diesen Kriterien keine passenden Fotografen finden. Können wir das Budget erweitern oder Datum/Ort flexibler gestalten?"
              : detectedLang === "fr" ? "Je n'ai pas trouvé de correspondance exacte avec ces critères. Pouvons-nous élargir le budget ou être flexible sur la date/le lieu ?"
              : "I couldn't find an exact match for those criteria. Could we widen the budget or flex on date/location?";
          }
        } else {
          action = {
            type: "show_matches",
            data: { matches: enriched, reply_text: args.reply_text || "", target_date: targetDate },
          };
        }
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
      } else if (tc.function.name === "show_spots") {
        // Hydrate spot cards. Each spot maps to /spots/<city>/<slug> on
        // the site. We resolve the spot from photoSpots so we can attach
        // a cover image (first curated image) + the localized name. If a
        // (city, slug) pair doesn't resolve, drop it silently so the
        // model can't poison the chat with bad URLs.
        const { photoSpots, spotSlug } = await import("@/lib/photo-spots-data");
        const items = (args.spots || []).map((sp: { city: string; slug: string; reason: string }) => {
          const cityKey = String(sp.city || "").toLowerCase();
          const wantedSlug = String(sp.slug || "").toLowerCase();
          const cityList = photoSpots[cityKey];
          if (!cityList) return null;
          const found = cityList.find((s) => spotSlug(s.name) === wantedSlug);
          if (!found) return null;
          // Prefer the curated hero image; if absent, leave cover_image
          // null and let the client render a placeholder card.
          const coverImage = found.images?.[0]?.url || null;
          return {
            city: cityKey,
            slug: wantedSlug,
            name: found.name,
            name_pt: found.namePt,
            name_de: found.nameDe,
            name_es: found.nameEs,
            name_fr: found.nameFr,
            description: found.description,
            cover_image: coverImage,
            reason: sp.reason,
          };
        }).filter(Boolean);
        action = {
          type: "show_spots",
          data: { spots: items, reply_text: args.reply_text || "" },
        };
      } else if (tc.function.name === "offer_blind_booking") {
        // Server is source of truth for price — LLM is forbidden from
        // quoting EUR in reply_text. We look up region_pricing here
        // and silently drop the action if the slug/occasion/duration
        // combo isn't priced. Hold is minted so the inline form has
        // something to POST against.
        const region = String(args.region || "").trim().toLowerCase();
        const date = String(args.date || "").trim();
        const occasion = String(args.occasion || "").trim().toLowerCase();
        const partySize = Number(args.party_size);
        const durationMinutes = Number(args.duration_minutes) || 60;
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
        // Reject past dates (audit finding #9). Compare in UTC; the
        // LLM may interpret "tomorrow" loosely, so today is allowed.
        const isFuture = (() => {
          if (!validDate) return false;
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          return new Date(date + "T00:00:00Z") >= today;
        })();
        if (region && validDate && isFuture && occasion && partySize > 0) {
          const { priceForSlug, slugToRegion } = await import("@/lib/blind-booking/pricing");
          const priced = await priceForSlug(region, occasion, durationMinutes);
          const canonicalRegion = slugToRegion(region);
          if (priced && canonicalRegion) {
            const { mintHold } = await import("@/lib/blind-booking/holds");
            const holdId = mintHold({
              chat_id: chat_id || "anonymous",
              region: canonicalRegion,
              date,
              occasion,
              party_size: partySize,
              duration_minutes: priced.duration_minutes,
              price_eur: priced.price_eur,
            });
            action = {
              type: "offer_blind_booking",
              data: {
                hold_id: holdId,
                region: canonicalRegion,
                slug: region,
                date,
                occasion,
                party_size: partySize,
                duration_minutes: priced.duration_minutes,
                price_eur: priced.price_eur,
                sample_size: priced.sample_size,
                reply_text: args.reply_text || "",
              },
            };
          }
          // priced=null OR canonicalRegion=null → no card; LLM's
          // reply_text still renders as a plain message and the LLM
          // can self-correct on the next turn.
        }
      } else if (tc.function.name === "request_human_match") {
        action = {
          type: "human_handoff",
          data: {
            reason: args.reason,
            summary: args.summary,
            contact_email: args.contact_email || null,
            contact_phone: args.contact_phone || null,
            contact_refused: !!args.contact_refused,
          },
        };
      }
    }
  }

  // Reply text: tool's reply_text > content > fallback. Strip the
  // accidental "AABB AABB" double-paste the model sometimes emits when
  // it merges a text reply with a tool reply_text — both ended up in
  // content and we'd display the same sentence twice.
  let rawReplyText =
    emptyMatchesApology ||
    (action?.data?.reply_text as string | undefined) ||
    msg.content ||
    "";
  // Safety net: when the AI fires request_human_match it MUST send a
  // confirmation back (system prompt says so), but if it slips up we
  // inject a friendly default rather than leave the visitor staring at
  // a blank turn after they shared their contact.
  if (!rawReplyText.trim() && action?.type === "human_handoff") {
    rawReplyText = "Thanks! Saved your contact — our team will reach out within a few hours 🙌";
  }
  const replyText = dedupeAdjacentParagraphs(rawReplyText);

  // Persist chat in DB
  const newChatMessages = [
    ...messages,
    { role: "assistant" as const, content: replyText, action },
  ];

  const cleanAttribution = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 255) : null;
  const attributionFromBody = attribution || {};
  const utm = {
    source: cleanAttribution(attributionFromBody.utm_source) || req.cookies.get("utm_source")?.value || null,
    medium: cleanAttribution(attributionFromBody.utm_medium) || req.cookies.get("utm_medium")?.value || null,
    campaign: cleanAttribution(attributionFromBody.utm_campaign) || req.cookies.get("utm_campaign")?.value || null,
    term: cleanAttribution(attributionFromBody.utm_term) || req.cookies.get("utm_term")?.value || null,
    gclid: cleanAttribution(attributionFromBody.gclid) || req.cookies.get("gclid")?.value || null,
  };
  if (utm.gclid && !utm.source) utm.source = "google";
  if (utm.gclid && !utm.medium) utm.medium = "cpc";
  // Cookie/body-based UTM can be incomplete when the visitor opens the
  // drawer many minutes after landing. If we have a gclid, recover the
  // original ad_visit row and fill any missing fields.
  if (utm.gclid && (!utm.source || !utm.term || !utm.campaign)) {
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
         utm_source = COALESCE(utm_source, $9),
         utm_medium = COALESCE(utm_medium, $10),
         utm_campaign = COALESCE(utm_campaign, $11),
         utm_term = COALESCE(utm_term, $12),
         gclid = COALESCE(gclid, $13),
         updated_at = NOW()
       WHERE id = $14 RETURNING id`,
      [
        JSON.stringify(newChatMessages),
        email || null,
        first_name || null,
        language || null,
        usage?.total_tokens || 0,
        costUsd,
        matchedPhotogIds,
        outcomeFor(action),
        utm.source,
        utm.medium,
        utm.campaign,
        utm.term,
        utm.gclid,
        chatId,
      ]
    ).catch((e) => { console.error("[concierge] update error:", e); return null; });
    if (!updated) chatId = undefined;
  }

  if (!chatId) {
    const created = await queryOne<{ id: string }>(
      `INSERT INTO concierge_chats (visitor_id, user_id, email, first_name, messages, matched_photographer_ids, outcome, language, total_tokens, total_cost_usd, utm_source, utm_medium, utm_campaign, utm_term, gclid, source, page_context, source_chip)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
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
        typeof source_chip === "string" && source_chip.trim() ? source_chip.trim().slice(0, 200) : null,
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

  // Per-recommendation analytics. Fire-and-forget — funnel data is
  // valuable but never worth blocking the chat reply for. Re-uses the
  // segment we already classified upstream for epsilon selection.
  if (chatId && recommendationSnapshots.length > 0) {
    void logRecommendations(chatId, trafficSegment, recommendationSnapshots);
  }

  // Forward terminal-event chats to admins in Telegram (new "ИИ Консьерж"
  // topic). Fires once the AI either shows matches OR escalates to a
  // human; subsequent show_matches in the same chat are deduped via the
  // shownSlugs heuristic — admin sees the freshest snapshot. Fire-and-
  // forget so a Telegram outage never blocks the chat response.
  if (action && (action.type === "show_matches" || action.type === "human_handoff" || action.type === "offer_blind_booking")) {
    // Gate human_handoff: don't ping admins if we have NO way to follow
    // up. Either the AI captured a contact (contact_email/phone in the
    // tool call), the chat session already has one (email param or
    // stored phone), or the visitor explicitly refused to share — in
    // which case the ping is pointless because the lead is dead.
    let shouldNotify = true;
    if (action.type === "human_handoff") {
      // Validate before treating tool's contact_phone / contact_email
      // as a real lead. The model sometimes parrots whatever the visitor
      // typed (e.g. "234234") and we don't want junk pinging admins.
      const rawEmail = (action.data?.contact_email as string | null) || null;
      const rawPhone = (action.data?.contact_phone as string | null) || null;
      const validToolEmail = rawEmail && rawEmail.includes("@") && rawEmail.includes(".") && rawEmail.length >= 6 ? rawEmail : null;
      const validToolPhone = rawPhone && rawPhone.replace(/\D/g, "").length >= 8 ? rawPhone : null;
      const sessionPhone = chatId
        ? await queryOne<{ phone: string | null }>(
            "SELECT phone FROM concierge_chats WHERE id = $1", [chatId]
          ).then((r) => r?.phone || null).catch(() => null)
        : null;
      const validSessionPhone = sessionPhone && sessionPhone.replace(/\D/g, "").length >= 8 ? sessionPhone : null;
      const hasContact = !!(validToolEmail || validToolPhone || email || validSessionPhone);
      if (!hasContact) {
        shouldNotify = false;
        // Tag outcome so we can see this in stats (X% of handoffs had
        // no contact captured = the AI is escalating prematurely).
        if (chatId) {
          await queryOne(
            "UPDATE concierge_chats SET outcome = 'human_handoff_no_contact', updated_at = NOW() WHERE id = $1 RETURNING id",
            [chatId]
          ).catch(() => null);
        }
      }
    }
    if (shouldNotify) {
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
    : opts.action.type === "offer_blind_booking"
      ? "🎯 <b>Concierge: blind-booking offer shown</b>"
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
  } else if (opts.action.type === "offer_blind_booking") {
    const d = opts.action.data || {};
    const region = String(d.region || "");
    const occasion = String(d.occasion || "");
    const date = String(d.date || "");
    const partySize = Number(d.party_size) || 0;
    const durationMinutes = Number(d.duration_minutes) || 0;
    const priceEur = Number(d.price_eur) || 0;
    lines.push("");
    lines.push(`<b>Offer:</b> ${escapeHtml(region)} · ${escapeHtml(occasion)} · ${escapeHtml(date)}`);
    lines.push(`<b>${partySize} ${partySize === 1 ? "person" : "people"} · ${durationMinutes} min · €${priceEur}</b> (auth-hold pending visitor click)`);
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

// Drop adjacent identical paragraphs from a model reply. OpenAI's
// tool-calling sometimes returns the same sentence both in `content`
// and embedded in the tool's `reply_text`, which gets merged upstream
// and surfaces as "Foo. Foo." in the chat bubble.
function dedupeAdjacentParagraphs(text: string): string {
  const parts = text.split(/\n\s*\n/);
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && out[out.length - 1].trim() === p.trim()) continue;
    out.push(p);
  }
  // Also collapse the simpler case "AAAA AAAA" (no blank line between).
  let result = out.join("\n\n");
  result = result.replace(/^([\s\S]{20,400})\s+\1$/, "$1");
  return result;
}
