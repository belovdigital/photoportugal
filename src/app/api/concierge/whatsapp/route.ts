// Concierge WhatsApp lead capture. Called when a visitor picks the
// "Continue on WhatsApp" CTA after matches are shown. We:
//   1. Save their phone on the chat row (so admins have it even if the
//      visitor never actually sends the WhatsApp message).
//   2. Forward an inbound notification to the concierge Telegram topic.
//   3. Return a wa.me URL pre-filled with a short summary so the visitor
//      lands in WhatsApp ready to send to us.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { computeLeadScore } from "@/lib/concierge/lead-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Photo Portugal's primary WhatsApp number (international format, no
// "+", spaces or dashes — wa.me requires the bare digits).
const PHOTOPORTUGAL_WA_NUMBER = "351962598883";

interface ChatRow {
  id: string;
  email: string | null;
  first_name: string | null;
  language: string | null;
  utm_source: string | null;
  gclid: string | null;
  outcome: string | null;
  matched_photographer_ids: string[] | null;
  inquiry_booking_ids: string[] | null;
  messages: { role: string; content: string; action?: { type?: string; data?: { matches?: { slug: string }[] } } | null }[];
  created_at: string;
  updated_at: string;
  occasion: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { chat_id, phone, first_name } = body as { chat_id?: string; phone?: string; first_name?: string };
  if (!chat_id || !phone || !phone.trim()) {
    return NextResponse.json({ error: "chat_id and phone required" }, { status: 400 });
  }
  // Validate: must look like a phone number, not a sentence. We saw
  // chats land with phone="My husband has mobility issues a" because
  // the legacy frontend sent raw text whenever digits.length >= 6 was
  // anywhere in the input. Reject anything where digits are <6 OR the
  // non-digit content exceeds the digits by 2x (heuristic for "text
  // with a phone buried in it"). Keep at most 32 chars on storage.
  const cleanPhone = phone.trim().slice(0, 32);
  const digits = cleanPhone.replace(/\D/g, "");
  const nonDigits = cleanPhone.length - digits.length;
  if (digits.length < 6) {
    return NextResponse.json({ error: "Phone must contain at least 6 digits" }, { status: 400 });
  }
  if (nonDigits > digits.length) {
    return NextResponse.json({ error: "Phone field looks like text, not a number" }, { status: 400 });
  }

  const chat = await queryOne<ChatRow>(
    `UPDATE concierge_chats
        SET phone = $1,
            phone_captured_at = COALESCE(phone_captured_at, NOW()),
            first_name = COALESCE(first_name, $2),
            updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, first_name, language, utm_source, gclid, outcome,
                matched_photographer_ids, inquiry_booking_ids, messages,
                created_at, updated_at, occasion`,
    [cleanPhone, first_name?.trim() || null, chat_id]
  ).catch((err) => {
    console.error("[concierge/whatsapp] update error:", err);
    return null;
  });

  if (!chat) {
    return NextResponse.json({ error: "chat not found" }, { status: 404 });
  }

  // Build a pre-filled WhatsApp message for the visitor to send to us.
  // We use the same intent extraction the chat uses so it reads natural.
  const userMsgs = (chat.messages || [])
    .filter((m) => m.role === "user")
    .map((m) => (m.content || "").replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, ""))
    .filter((s) => s.trim().length > 4);
  const lastSubstantive = userMsgs.filter((m) => m.length > 30).slice(-1)[0] || userMsgs.slice(-1)[0] || "";
  const hi = chat.first_name ? `Hi! It's ${chat.first_name}.` : "Hi!";
  const intent = lastSubstantive ? `\n\nMy plan: ${lastSubstantive.slice(0, 240)}` : "";
  const handoff = `\n\nI was chatting with Lens (your AI concierge) about a photoshoot — could you help me finalise it?`;
  const text = encodeURIComponent(`${hi}${intent}${handoff}`);
  const wa_url = `https://wa.me/${PHOTOPORTUGAL_WA_NUMBER}?text=${text}`;

  // Fire-and-forget Telegram notification to the ИИ Консьерж topic so
  // admins see the lead immediately even if the visitor doesn't end up
  // sending the WhatsApp message. Resolves photographer UUIDs → names so
  // admins see "Daria Zolotova" not "72074746-9d3c-4c81-...".
  void (async () => {
    try {
      const { sendTelegram } = await import("@/lib/telegram");

      // Resolve photographer names + slugs from the UUIDs stored on the chat.
      // Doing this once per WhatsApp lead is cheap (≤3 IDs typical).
      const ids = (chat.matched_photographer_ids || []).slice(0, 4);
      let photogLines: string[] = [];
      if (ids.length > 0) {
        const rows = await query<{ id: string; slug: string; name: string }>(
          `SELECT pp.id, pp.slug, u.name FROM photographer_profiles pp
             JOIN users u ON u.id = pp.user_id
            WHERE pp.id = ANY($1::uuid[])`,
          [ids]
        ).catch(() => [] as { id: string; slug: string; name: string }[]);
        const byId = new Map(rows.map((r) => [r.id, r]));
        photogLines = ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((p) => `• <b>${escapeHtml(p!.name)}</b> (<a href="https://photoportugal.com/photographers/${p!.slug}">${escapeHtml(p!.slug)}</a>)`);
      }

      // Lead heat — same heuristic the admin dashboard uses, so Telegram
      // and admin agree on hot/warm/cold at a glance.
      const ls = computeLeadScore({
        email: chat.email,
        phone: cleanPhone,
        gclid: chat.gclid,
        utm_source: chat.utm_source,
        outcome: chat.outcome,
        matched_photographer_ids: chat.matched_photographer_ids,
        inquiry_booking_ids: chat.inquiry_booking_ids,
        messages: chat.messages || [],
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        occasion: chat.occasion,
      });
      const heatBadge = ls.heat === "hot" ? `🔥 HOT ${ls.score}` : ls.heat === "warm" ? `🟡 WARM ${ls.score}` : `🔵 ${ls.score}`;

      // Clickable phone — wa.me requires digits only, no "+".
      const phoneDigits = cleanPhone.replace(/\D/g, "");
      const phoneLink = phoneDigits.length >= 6
        ? `<a href="https://wa.me/${phoneDigits}?text=${encodeURIComponent("Hi! This is Photo Portugal — saw you wanted to chat about your photoshoot.")}">📱 ${escapeHtml(cleanPhone)}</a>`
        : `<code>${escapeHtml(cleanPhone)}</code>`;

      // Last 3 user messages for context (was just one before).
      const recentMsgs = userMsgs.slice(-3).map((m) => `  • <i>"${escapeHtml(m.length > 160 ? m.slice(0, 160) + "…" : m)}"</i>`);

      const lines = [
        `📱 <b>Concierge: WhatsApp lead captured</b> · ${heatBadge}`,
        `<b>WhatsApp:</b> ${phoneLink}${chat.first_name ? ` · ${escapeHtml(chat.first_name)}` : ""}${chat.email ? ` · ${escapeHtml(chat.email)}` : ""}`,
        chat.language ? `<b>Lang:</b> ${chat.language}` : null,
        recentMsgs.length > 0 ? `<b>What they said:</b>\n${recentMsgs.join("\n")}` : null,
        photogLines.length > 0 ? `<b>Photographers shown:</b>\n${photogLines.join("\n")}` : null,
        "",
        `<a href="https://photoportugal.com/admin?tab=concierge&chat=${chat.id}">Open in admin →</a>`,
      ].filter(Boolean).join("\n");
      await sendTelegram(lines, "concierge");
    } catch (err) {
      console.error("[concierge/whatsapp] telegram notify error:", err);
    }
  })();

  return NextResponse.json({ ok: true, wa_url });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
