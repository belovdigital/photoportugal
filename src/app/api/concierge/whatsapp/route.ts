// Concierge WhatsApp lead capture. Called when a visitor picks the
// "Continue on WhatsApp" CTA after matches are shown. We:
//   1. Save their phone on the chat row (so admins have it even if the
//      visitor never actually sends the WhatsApp message).
//   2. Forward an inbound notification to the concierge Telegram topic.
//   3. Return a wa.me URL pre-filled with a short summary so the visitor
//      lands in WhatsApp ready to send to us.

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

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
  matched_photographer_ids: string[] | null;
  messages: { role: string; content: string; action?: { type?: string; data?: { matches?: { slug: string }[] } } | null }[];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { chat_id, phone, first_name } = body as { chat_id?: string; phone?: string; first_name?: string };
  if (!chat_id || !phone || !phone.trim()) {
    return NextResponse.json({ error: "chat_id and phone required" }, { status: 400 });
  }
  const cleanPhone = phone.trim().slice(0, 32);

  const chat = await queryOne<ChatRow>(
    `UPDATE concierge_chats
        SET phone = $1,
            phone_captured_at = COALESCE(phone_captured_at, NOW()),
            first_name = COALESCE(first_name, $2),
            updated_at = NOW()
      WHERE id = $3
      RETURNING id, email, first_name, language, matched_photographer_ids, messages`,
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
  // sending the WhatsApp message.
  void (async () => {
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      const photogList = (chat.matched_photographer_ids || []).slice(0, 3).join(", ") || "(none)";
      const lines = [
        "📱 <b>Concierge: WhatsApp lead captured</b>",
        `<b>Phone:</b> <code>${escapeHtml(cleanPhone)}</code>${chat.first_name ? ` · ${escapeHtml(chat.first_name)}` : ""}${chat.email ? ` · ${escapeHtml(chat.email)}` : ""}`,
        chat.language ? `<b>Lang:</b> ${chat.language}` : null,
        lastSubstantive ? `<b>Intent:</b> <i>${escapeHtml(lastSubstantive.slice(0, 240))}</i>` : null,
        `<b>Photographers shown:</b> ${escapeHtml(photogList.slice(0, 200))}`,
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
