import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";

// Concierge fallback: AI couldn't auto-match → create a human match request.
export async function POST(req: NextRequest) {
  const { chat_id, email, first_name, summary, location_slug, shoot_type } = await req.json().catch(() => ({}));
  if (!chat_id || !email) return NextResponse.json({ error: "chat_id and email required" }, { status: 400 });

  const placeholderName = (first_name && first_name.trim()) || String(email).split("@")[0] || "Guest";
  const matchReq = await queryOne<{ id: string }>(
    `INSERT INTO match_requests (email, name, location_slug, shoot_type, message, source, status)
     VALUES ($1, $2, $3, $4, $5, 'concierge_handoff', 'new')
     RETURNING id`,
    [email, placeholderName, location_slug || "portugal", shoot_type || null, summary || null]
  ).catch((e) => { console.error("[concierge/handoff] insert error:", e); return null; });

  if (matchReq) {
    await queryOne(
      `UPDATE concierge_chats SET match_request_id = $1, email = COALESCE($2, email), first_name = COALESCE($3, first_name), outcome = 'human_handoff', updated_at = NOW() WHERE id = $4 RETURNING id`,
      [matchReq.id, email, first_name || null, chat_id]
    ).catch(() => null);
  }

  try {
    const { sendTelegram } = await import("@/lib/telegram");
    const ctx = await queryOne<{ messages: { role: string; content: string }[]; utm_source: string | null; utm_term: string | null; country: string | null }>(
      "SELECT messages, utm_source, utm_term, country FROM concierge_chats WHERE id = $1",
      [chat_id]
    ).catch(() => null);
    const userTurns = (ctx?.messages || []).filter((m) => m.role === "user").map((m) => m.content);
    const transcript = userTurns.slice(-3).map((t) => `  • <i>"${t.length > 150 ? t.slice(0, 150) + "…" : t}"</i>`).join("\n");
    const sourceParts = [
      ctx?.utm_source ? `utm: ${ctx.utm_source}` : null,
      ctx?.utm_term ? `kw: "${ctx.utm_term}"` : null,
      ctx?.country ? `country: ${ctx.country}` : null,
    ].filter(Boolean).join(" · ");

    await sendTelegram(
      `👤 <b>Concierge handoff — AI couldn't match</b> 🆘\n\n` +
      `<b>Email:</b> ${email}\n` +
      (first_name ? `<b>Name:</b> ${first_name}\n` : "") +
      (location_slug ? `<b>Location:</b> ${location_slug}\n` : "") +
      (shoot_type ? `<b>Shoot type:</b> ${shoot_type}\n` : "") +
      `\n<b>AI summary:</b>\n<i>${summary || "(no summary)"}</i>\n` +
      (transcript ? `\n<b>What they said:</b>\n${transcript}\n` : "") +
      (sourceParts ? `\n<b>Source:</b> ${sourceParts}\n` : "") +
      `\n<a href="https://photoportugal.com/admin?tab=match-requests">Open in admin</a>`,
      "clients"
    ).catch(() => {});
  } catch (err) {
    console.error("[concierge/handoff] telegram error:", err);
  }

  return NextResponse.json({ ok: true, match_request_id: matchReq?.id });
}
