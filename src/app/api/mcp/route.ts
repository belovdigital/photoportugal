import { NextRequest, NextResponse } from "next/server";
import {
  MARKETS,
  findDestination,
  bookableDestinations,
  enabledMarkets,
  OCCASIONS,
  DURATIONS,
  LANGUAGES,
} from "@/lib/phototravel/catalogue";

export const dynamic = "force-dynamic";

/**
 * PhotoTravel — MCP endpoint for ChatGPT and any other agent client.
 *
 * Stateless JSON-RPC 2.0 over a single POST. We implement the protocol
 * directly rather than pulling in the MCP SDK: the SDK's HTTP transports
 * want raw Node req/res, which a Next route handler does not hand out, and
 * the surface we need is four methods.
 *
 * The channel is deliberately limited to blind booking — the traveller
 * names a place, a date and an occasion, pays a fixed all-in price, and we
 * hand-pick the photographer within 24h. No per-photographer availability
 * is exposed, because that comes from the calendar sync where a partial
 * fetch reads as "free" rather than as an error, and an agent confidently
 * selling a slot that is actually taken is worse than no channel at all.
 *
 * Money: the tools return the client-inclusive total only. The upstream
 * price endpoint also returns the photographer base and our service fee;
 * both are stripped here and must never reach the model.
 */

const SERVER_NAME = "PhotoTravel";
const SERVER_VERSION = "0.1.0";
const FALLBACK_PROTOCOL = "2025-06-18";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type RpcId = string | number | null;

interface RpcRequest {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

function ok(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * A tool-level failure the model can recover from (bad slug, past date).
 * MCP wants these as a successful result carrying isError, not as a
 * protocol error — a protocol error tells the client the call was
 * malformed, which stops the model retrying with better arguments.
 */
function toolError(message: string) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function toolOk(text: string, structured: Record<string, JsonValue>) {
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
  };
}

// ── Tool definitions ────────────────────────────────────────────────────

function toolDefinitions() {
  const slugs = bookableDestinations().map((d) => d.slug);
  const countries = enabledMarkets().map((m) => m.country).join(" and ");

  return [
    {
      name: "list_destinations",
      title: "List destinations",
      description:
        `Every place PhotoTravel can currently book a photographer in (${countries}). ` +
        "Call this first when the traveller names a city you are unsure about, or when " +
        "they ask where shoots are available. Returns the exact slugs the other tools expect.",
      inputSchema: {
        type: "object",
        properties: {
          area: {
            type: "string",
            description:
              "Optional case-insensitive filter on the area name, e.g. \"Algarve\" or \"Azores\".",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_photoshoot_quote",
      title: "Get a photoshoot price",
      description:
        "The exact all-in price for a photoshoot. The price is fixed and already includes " +
        "everything — there is nothing added at checkout. Always quote before booking.",
      inputSchema: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            enum: slugs,
            description: "Destination slug from list_destinations.",
          },
          occasion: {
            type: "string",
            enum: [...OCCASIONS],
            description: "What the shoot is for. Use \"other\" only if nothing else fits.",
          },
          duration_minutes: {
            type: "integer",
            enum: [...DURATIONS],
            description: "Length of the shoot: 60, 120 or 180 minutes.",
          },
          party_size: {
            type: "integer",
            minimum: 1,
            maximum: 30,
            description: "How many people will be photographed. Groups of 9+ cost more.",
          },
        },
        required: ["destination", "occasion", "duration_minutes", "party_size"],
        additionalProperties: false,
      },
    },
    {
      name: "create_photoshoot_booking",
      title: "Book a photoshoot",
      description:
        "Creates the booking and returns a secure checkout link the traveller opens to " +
        "authorise payment. The card is only authorised, not charged: we hand-pick the " +
        "photographer within 24 hours and charge only once they are confirmed, with a full " +
        "refund if we cannot match. Confirm the destination, date, occasion, duration, party " +
        "size and price with the traveller BEFORE calling this — it creates a real booking. " +
        "Never invent the contact details; ask for them.",
      inputSchema: {
        type: "object",
        properties: {
          destination: { type: "string", enum: slugs, description: "Destination slug." },
          occasion: { type: "string", enum: [...OCCASIONS] },
          duration_minutes: { type: "integer", enum: [...DURATIONS] },
          party_size: { type: "integer", minimum: 1, maximum: 30 },
          date: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Date of the shoot, YYYY-MM-DD. Must be today or later.",
          },
          name: { type: "string", description: "Traveller's full name." },
          email: { type: "string", description: "Email for the confirmation and the gallery." },
          phone: {
            type: "string",
            description: "WhatsApp or phone number, used to reach them on the day.",
          },
          notes: {
            type: "string",
            description:
              "Optional. Anything useful for the photographer: preferred meeting point, " +
              "time of day, occasion details, mobility needs.",
          },
          language: {
            type: "string",
            enum: [...LANGUAGES],
            description: "Language for the confirmation email and checkout page. Defaults to en.",
          },
        },
        required: [
          "destination",
          "occasion",
          "duration_minutes",
          "party_size",
          "date",
          "name",
          "email",
          "phone",
        ],
        additionalProperties: false,
      },
    },
  ];
}

// ── Upstream calls ──────────────────────────────────────────────────────

function agentHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // Lets the upstream booking endpoint tell this channel apart from a
  // browser. Without it every agent booking shares one server IP and trips
  // the per-IP limit meant for spam. The per-email limit still applies.
  const key = process.env.AGENT_CHANNEL_KEY;
  if (key) h["x-agent-channel-key"] = key;
  return h;
}

interface QuoteArgs {
  destination: string;
  occasion: string;
  duration_minutes: number;
  party_size: number;
}

function validateQuoteArgs(a: Record<string, unknown>): QuoteArgs | string {
  const destination = String(a.destination || "").trim().toLowerCase();
  const dest = findDestination(destination);
  if (!dest) {
    return `We do not currently shoot in "${destination}". Call list_destinations for the places available.`;
  }
  const occasion = String(a.occasion || "").trim().toLowerCase();
  if (!(OCCASIONS as readonly string[]).includes(occasion)) {
    return `"${occasion}" is not a valid occasion. Choose one of: ${OCCASIONS.join(", ")}.`;
  }
  const duration = Number(a.duration_minutes);
  if (!(DURATIONS as readonly number[]).includes(duration)) {
    return "Duration must be 60, 120 or 180 minutes.";
  }
  const party = Number(a.party_size);
  if (!Number.isInteger(party) || party < 1 || party > 30) {
    return "Party size must be a whole number between 1 and 30.";
  }
  return { destination, occasion, duration_minutes: duration, party_size: party };
}

interface UpstreamQuote {
  total_eur: number;
  compare_at_eur: number;
  savings_eur: number;
  large_group_applied: boolean;
}

async function fetchQuote(args: QuoteArgs): Promise<UpstreamQuote | string> {
  const dest = findDestination(args.destination);
  if (!dest) return "Unknown destination.";
  const base = MARKETS[dest.market].baseUrl;
  const url =
    `${base}/api/blind-booking/price?region=${encodeURIComponent(args.destination)}` +
    `&occasion=${encodeURIComponent(args.occasion)}` +
    `&duration=${args.duration_minutes}&party_size=${args.party_size}`;

  const res = await fetch(url, { headers: agentHeaders(), cache: "no-store" });
  if (res.status === 404) {
    return `We do not have pricing for a ${args.occasion} shoot in ${dest.name} yet. Try a different occasion or duration.`;
  }
  if (!res.ok) {
    return "Pricing is temporarily unavailable. Ask the traveller to try again in a moment.";
  }
  const data = (await res.json()) as Record<string, unknown>;
  // Deliberately narrow: the upstream payload also carries base_eur and
  // service_fee_eur, which are photographer-facing numbers.
  return {
    total_eur: Number(data.total_eur),
    compare_at_eur: Number(data.compare_at_eur || 0),
    savings_eur: Number(data.savings_eur || 0),
    large_group_applied: Boolean(data.large_group_applied),
  };
}

// ── Tool handlers ───────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "list_destinations") {
    const filter = String(args.area || "").trim().toLowerCase();
    const all = bookableDestinations();
    const list = filter ? all.filter((d) => d.area.toLowerCase().includes(filter)) : all;
    if (list.length === 0) {
      return toolError(
        `No destinations match "${filter}". Call list_destinations with no filter to see everything.`
      );
    }
    const rows = list.map((d) => ({
      slug: d.slug,
      name: d.name,
      area: d.area,
      country: MARKETS[d.market].country,
    }));
    const text = list.map((d) => `${d.name} (${d.slug}) — ${d.area}`).join("\n");
    return toolOk(text, { destinations: rows as unknown as JsonValue, count: rows.length });
  }

  if (name === "get_photoshoot_quote") {
    const parsed = validateQuoteArgs(args);
    if (typeof parsed === "string") return toolError(parsed);
    const quote = await fetchQuote(parsed);
    if (typeof quote === "string") return toolError(quote);

    const dest = findDestination(parsed.destination)!;
    const hours = parsed.duration_minutes / 60;
    const text =
      `${hours} hour${hours === 1 ? "" : "s"} in ${dest.name} for ${parsed.party_size} ` +
      `${parsed.party_size === 1 ? "person" : "people"}: €${quote.total_eur} all-in.` +
      (quote.savings_eur > 0 ? ` Normally €${quote.compare_at_eur} — saving €${quote.savings_eur}.` : "") +
      " Nothing is added at checkout. We hand-pick the photographer within 24 hours; the card is " +
      "only charged once they are confirmed, and fully refunded if we cannot match.";

    return toolOk(text, {
      destination: dest.name,
      destination_slug: dest.slug,
      country: MARKETS[dest.market].country,
      occasion: parsed.occasion,
      duration_minutes: parsed.duration_minutes,
      party_size: parsed.party_size,
      total_eur: quote.total_eur,
      compare_at_eur: quote.compare_at_eur || null,
      savings_eur: quote.savings_eur || null,
      large_group_surcharge_applied: quote.large_group_applied,
      currency: "EUR",
    });
  }

  if (name === "create_photoshoot_booking") {
    const parsed = validateQuoteArgs(args);
    if (typeof parsed === "string") return toolError(parsed);

    const date = String(args.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return toolError("Date must be in YYYY-MM-DD format.");
    }
    // Compare as plain dates so a shoot booked for "today" anywhere in
    // Europe is not rejected by a UTC clock a few hours ahead.
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return toolError(`${date} is in the past. Ask the traveller for a date from ${today} onwards.`);
    }

    const name_ = String(args.name || "").trim();
    const email = String(args.email || "").trim().toLowerCase();
    const phone = String(args.phone || "").trim();
    if (name_.length < 2) return toolError("Ask the traveller for the name the booking should be in.");
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return toolError("That email does not look valid. Ask the traveller to confirm it.");
    }
    if (phone.replace(/\D/g, "").length < 6) {
      return toolError(
        "A reachable phone or WhatsApp number is required so the photographer can find them on the day."
      );
    }

    const rawLang = String(args.language || "en").trim().toLowerCase();
    const language = (LANGUAGES as readonly string[]).includes(rawLang) ? rawLang : "en";
    const dest = findDestination(parsed.destination)!;
    const market = MARKETS[dest.market];

    const res = await fetch(`${market.baseUrl}/api/concierge/blind-booking/accept`, {
      method: "POST",
      headers: agentHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        region: parsed.destination,
        occasion: parsed.occasion,
        duration_minutes: parsed.duration_minutes,
        party_size: parsed.party_size,
        date,
        name: name_,
        email,
        phone,
        meeting_hint: String(args.notes || "").trim().slice(0, 500),
        locale: language,
        source: "phototravel-mcp",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 429) {
      return toolError("Too many booking attempts just now. Ask the traveller to try again in a minute.");
    }
    if (!res.ok || !data.checkout_url) {
      const why = typeof data.error === "string" ? data.error : "The booking could not be created.";
      return toolError(`${why} Nothing has been charged.`);
    }

    const text =
      `Booked ${dest.name} on ${date}. Send the traveller this secure checkout link to authorise ` +
      `payment: ${String(data.checkout_url)}\n\n` +
      "Their card is authorised, not charged. We hand-pick the photographer within 24 hours and " +
      "charge only once confirmed — full refund if we cannot match. A confirmation email is on its way.";

    return toolOk(text, {
      booking_id: String(data.booking_id ?? ""),
      checkout_url: String(data.checkout_url),
      destination: dest.name,
      country: market.country,
      date,
      occasion: parsed.occasion,
      duration_minutes: parsed.duration_minutes,
      party_size: parsed.party_size,
      brand: market.brand,
    });
  }

  return toolError(`Unknown tool "${name}".`);
}

// ── JSON-RPC dispatch ───────────────────────────────────────────────────

async function dispatch(msg: RpcRequest) {
  const id = msg.id ?? null;
  const method = msg.method || "";
  const params = (msg.params || {}) as Record<string, unknown>;

  // Notifications carry no id and expect no reply.
  if (msg.id === undefined) return null;

  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : null;
      return ok(id, {
        // Echo the client's version when it sends one: this server has no
        // version-specific behaviour, and echoing keeps us compatible with
        // clients newer than this file.
        protocolVersion: requested || FALLBACK_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          "PhotoTravel books professional holiday photographers. Ask where and when the " +
          "traveller wants to shoot, what the occasion is, how long and how many people, then " +
          "quote before booking. The price is all-in and fixed. Booking creates a real " +
          "reservation, so confirm the details with the traveller first.",
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: toolDefinitions() });

    case "tools/call": {
      const name = String(params.name || "");
      const args = (params.arguments || {}) as Record<string, unknown>;
      if (!name) return fail(id, ERR.INVALID_PARAMS, "Missing tool name");
      try {
        return ok(id, await callTool(name, args));
      } catch (err) {
        console.error("[mcp] tool failed:", name, err);
        return ok(
          id,
          toolError("Something went wrong on our side. Nothing was charged; please try again.")
        );
      }
    }

    default:
      return fail(id, ERR.METHOD_NOT_FOUND, `Unknown method "${method}"`);
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(fail(null, ERR.PARSE, "Malformed JSON"), { status: 400, headers: CORS });
  }

  const batch = Array.isArray(payload);
  const messages = (batch ? payload : [payload]) as RpcRequest[];
  if (batch && messages.length === 0) {
    return NextResponse.json(fail(null, ERR.INVALID_REQUEST, "Empty batch"), {
      status: 400,
      headers: CORS,
    });
  }

  const replies = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
      replies.push(fail(null, ERR.INVALID_REQUEST, "Not a JSON-RPC request"));
      continue;
    }
    const reply = await dispatch(msg);
    if (reply) replies.push(reply);
  }

  // Every message was a notification — acknowledge with no body.
  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS });

  return NextResponse.json(batch ? replies : replies[0], { headers: CORS });
}

export async function GET() {
  // No server-initiated stream: this server never pushes, so the optional
  // SSE channel of the Streamable HTTP transport is not offered.
  return NextResponse.json(
    fail(null, ERR.METHOD_NOT_FOUND, "This MCP server is POST-only"),
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } }
  );
}
