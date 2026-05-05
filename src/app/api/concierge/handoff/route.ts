import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";

// Concierge handoff. Two trigger modes:
//   1. AI escalates (request_human_match tool) — payload usually carries
//      an email + AI summary; we keep the legacy match_request creation.
//   2. Visitor clicks the persistent "Ask a human" button — anonymous-
//      allowed handoff. We still notify admins on Telegram even without
//      email; match_request row is only created when an email is given.
export async function POST(req: NextRequest) {
  const { chat_id, email, first_name, summary, location_slug, shoot_type, manual } =
    (await req.json().catch(() => ({}))) as {
      chat_id?: string;
      email?: string;
      first_name?: string;
      summary?: string;
      location_slug?: string;
      shoot_type?: string;
      /** True when the visitor clicked the "Ask a human" button. */
      manual?: boolean;
    };
  if (!chat_id) return NextResponse.json({ error: "chat_id required" }, { status: 400 });

  let matchReqId: string | null = null;
  if (email) {
    const placeholderName = (first_name && first_name.trim()) || String(email).split("@")[0] || "Guest";
    const matchReq = await queryOne<{ id: string }>(
      `INSERT INTO match_requests (email, name, location_slug, shoot_type, message, source, status)
       VALUES ($1, $2, $3, $4, $5, 'concierge_handoff', 'new')
       RETURNING id`,
      [email, placeholderName, location_slug || "portugal", shoot_type || null, summary || null]
    ).catch((e) => { console.error("[concierge/handoff] insert error:", e); return null; });
    matchReqId = matchReq?.id || null;
  }

  await queryOne(
    `UPDATE concierge_chats SET
       match_request_id = COALESCE($1, match_request_id),
       email = COALESCE($2, email),
       first_name = COALESCE($3, first_name),
       outcome = 'human_handoff',
       updated_at = NOW()
     WHERE id = $4 RETURNING id`,
    [matchReqId, email || null, first_name || null, chat_id]
  ).catch(() => null);

  try {
    const { sendTelegram } = await import("@/lib/telegram");
    const ctx = await queryOne<{
      messages: { role: string; content: string; action?: { type?: string; data?: { matches?: { slug: string }[] } } | null }[];
      utm_source: string | null; utm_term: string | null; country: string | null;
      phone: string | null;
      matched_photographer_ids: string[] | null;
    }>(
      "SELECT messages, utm_source, utm_term, country, phone, matched_photographer_ids FROM concierge_chats WHERE id = $1",
      [chat_id]
    ).catch(() => null);
    const userTurns = (ctx?.messages || [])
      .filter((m) => m.role === "user")
      .map((m) => (m.content || "").replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, ""));
    const transcript = userTurns.slice(-3).map((t) => `  • <i>"${t.length > 150 ? t.slice(0, 150) + "…" : t}"</i>`).join("\n");
    const sourceParts = [
      ctx?.utm_source ? `utm: ${ctx.utm_source}` : null,
      ctx?.utm_term ? `kw: "${ctx.utm_term}"` : null,
      ctx?.country ? `country: ${ctx.country}` : null,
    ].filter(Boolean).join(" · ");

    const header = manual
      ? `🙋 <b>Concierge: visitor clicked "Ask a human"</b>`
      : `👤 <b>Concierge handoff — AI couldn't match</b> 🆘`;

    await sendTelegram(
      `${header}\n\n` +
      (email ? `<b>Email:</b> ${email}\n` : "<b>Email:</b> <i>not given</i>\n") +
      (ctx?.phone ? `<b>Phone:</b> <code>${ctx.phone}</code>\n` : "") +
      (first_name ? `<b>Name:</b> ${first_name}\n` : "") +
      (location_slug ? `<b>Location:</b> ${location_slug}\n` : "") +
      (shoot_type ? `<b>Shoot type:</b> ${shoot_type}\n` : "") +
      (summary ? `\n<b>${manual ? "Note" : "AI summary"}:</b>\n<i>${summary}</i>\n` : "") +
      (transcript ? `\n<b>What they said:</b>\n${transcript}\n` : "") +
      (sourceParts ? `\n<b>Source:</b> ${sourceParts}\n` : "") +
      `\n<a href="https://photoportugal.com/admin?tab=concierge&chat=${chat_id}">Open in admin</a>`,
      "concierge"
    ).catch(() => {});
  } catch (err) {
    console.error("[concierge/handoff] telegram error:", err);
  }

  return NextResponse.json({ ok: true, match_request_id: matchReqId });
}
