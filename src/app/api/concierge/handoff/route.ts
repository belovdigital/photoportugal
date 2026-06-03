import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { computeLeadScore } from "@/lib/concierge/lead-score";

export const runtime = "nodejs";

// Concierge handoff. Two trigger modes:
//   1. AI escalates (request_human_match tool) — payload usually carries
//      an email + AI summary; we keep the legacy match_request creation.
//   2. Visitor clicks the persistent "Ask a human" button — anonymous-
//      allowed handoff. We still notify admins on Telegram even without
//      email; match_request row is only created when an email is given.
export async function POST(req: NextRequest) {
  const { chat_id, email, phone, first_name, summary, location_slug, shoot_type, manual } =
    (await req.json().catch(() => ({}))) as {
      chat_id?: string;
      email?: string;
      phone?: string;
      first_name?: string;
      summary?: string;
      location_slug?: string;
      shoot_type?: string;
      /** True when the visitor clicked the "Ask a human" button. */
      manual?: boolean;
    };
  if (!chat_id) return NextResponse.json({ error: "chat_id required" }, { status: 400 });

  // Persist phone on the chat session up front so the gate below + the
  // admin Telegram both see it. We use a separate UPDATE because the
  // existing UPDATE further down only touches email/match_request_id.
  if (phone && phone.trim()) {
    await queryOne(
      "UPDATE concierge_chats SET phone = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
      [phone.trim(), chat_id]
    ).catch(() => null);
  }

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
      phone: string | null; gclid: string | null; outcome: string | null;
      email: string | null;
      matched_photographer_ids: string[] | null;
      inquiry_booking_ids: string[] | null;
      created_at: string; updated_at: string;
    }>(
      `SELECT messages, utm_source, utm_term, country, phone, gclid, outcome, email,
              matched_photographer_ids, inquiry_booking_ids,
              created_at, updated_at
         FROM concierge_chats WHERE id = $1`,
      [chat_id]
    ).catch(() => null);

    // Gate: skip Telegram if we have no contact (this endpoint is hit
    // by the "Ask a human" button which may run before the visitor has
    // shared email/phone). Mark outcome differently so we can see the
    // ghost rate in stats.
    const hasContact = !!(email || ctx?.email || ctx?.phone);
    if (!hasContact) {
      await queryOne(
        "UPDATE concierge_chats SET outcome = 'human_handoff_no_contact', updated_at = NOW() WHERE id = $1 RETURNING id",
        [chat_id]
      ).catch(() => null);
      return NextResponse.json({ ok: true, match_request_id: matchReqId, notified: false, reason: "no_contact" });
    }
    const userTurns = (ctx?.messages || [])
      .filter((m) => m.role === "user")
      .map((m) => (m.content || "").replace(/\s*\(slug:[a-z0-9-]+\)\s*$/i, ""));
    const transcript = userTurns.slice(-3).map((t) => `  • <i>"${escapeHtml(t.length > 160 ? t.slice(0, 160) + "…" : t)}"</i>`).join("\n");
    const sourceParts = [
      ctx?.utm_source ? `utm: ${ctx.utm_source}` : null,
      ctx?.utm_term ? `kw: "${ctx.utm_term}"` : null,
      ctx?.country ? `country: ${ctx.country}` : null,
    ].filter(Boolean).join(" · ");

    // Lead heat
    const ls = ctx ? computeLeadScore({
      email: email || null,
      phone: ctx.phone,
      gclid: ctx.gclid,
      utm_source: ctx.utm_source,
      outcome: ctx.outcome,
      matched_photographer_ids: ctx.matched_photographer_ids,
      inquiry_booking_ids: ctx.inquiry_booking_ids,
      messages: ctx.messages || [],
      created_at: ctx.created_at,
      updated_at: ctx.updated_at,
    }) : null;
    const heatBadge = ls
      ? (ls.heat === "hot" ? `🔥 HOT ${ls.score}` : ls.heat === "warm" ? `🟡 WARM ${ls.score}` : `🔵 ${ls.score}`)
      : null;

    // Resolve photographer UUIDs → names + clickable slugs (for the
    // "matches shown earlier" context line so admin can jump straight
    // to a profile when replying via WhatsApp).
    let photogLines = "";
    const ids = (ctx?.matched_photographer_ids || []).slice(0, 4);
    if (ids.length > 0) {
      const rows = await query<{ id: string; slug: string; name: string }>(
        `SELECT pp.id, pp.slug, u.name FROM photographer_profiles pp
           JOIN users u ON u.id = pp.user_id
          WHERE pp.id = ANY($1::uuid[])`,
        [ids]
      ).catch(() => [] as { id: string; slug: string; name: string }[]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((p) => `  • <b>${escapeHtml(p!.name)}</b> (<a href="https://photoportugal.com/photographers/${p!.slug}">${escapeHtml(p!.slug)}</a>)`);
      if (items.length > 0) photogLines = `<b>Photographers shown:</b>\n${items.join("\n")}`;
    }

    // Clickable phone (wa.me) when we have one
    let phoneLine = "";
    if (ctx?.phone) {
      const digits = ctx.phone.replace(/\D/g, "");
      phoneLine = digits.length >= 6
        ? `<b>WhatsApp:</b> <a href="https://wa.me/${digits}?text=${encodeURIComponent("Hi! This is Photo Portugal — about your photoshoot inquiry.")}">📱 ${escapeHtml(ctx.phone)}</a>`
        : `<b>Phone:</b> <code>${escapeHtml(ctx.phone)}</code>`;
    }

    const headerText = manual
      ? `🙋 <b>Concierge: visitor wants to talk to a human</b>`
      : `👤 <b>Concierge handoff — AI couldn't match</b> 🆘`;
    const header = heatBadge ? `${headerText} · ${heatBadge}` : headerText;

    const lines: (string | null)[] = [
      header,
      "",
      email ? `<b>Email:</b> ${escapeHtml(email)}` : null,
      phoneLine || null,
      first_name ? `<b>Name:</b> ${escapeHtml(first_name)}` : null,
      location_slug ? `<b>Location:</b> ${escapeHtml(location_slug)}` : null,
      shoot_type ? `<b>Shoot type:</b> ${escapeHtml(shoot_type)}` : null,
      summary ? `\n<b>${manual ? "Note" : "AI summary"}:</b>\n<i>${escapeHtml(summary)}</i>` : null,
      transcript ? `\n<b>What they said:</b>\n${transcript}` : null,
      photogLines ? `\n${photogLines}` : null,
      sourceParts ? `\n<b>Source:</b> ${escapeHtml(sourceParts)}` : null,
      "",
      `<a href="https://photoportugal.com/admin?tab=concierge&chat=${chat_id}">Open in admin →</a>`,
    ];
    await sendTelegram(lines.filter((l) => l !== null).join("\n"), "concierge").catch(() => {});
  } catch (err) {
    console.error("[concierge/handoff] telegram error:", err);
  }

  return NextResponse.json({ ok: true, match_request_id: matchReqId });
}

function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
