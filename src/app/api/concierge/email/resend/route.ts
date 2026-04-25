import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { emailLayout, emailButton, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; data: { matches?: Array<{ slug: string; reasoning: string }> } } | null;
}

// Re-send the LATEST set of matches to the email captured earlier in this chat.
// Used when the user refines and the AI shows new matches.
export async function POST(req: NextRequest) {
  const { chat_id } = await req.json().catch(() => ({}));
  if (!chat_id) return NextResponse.json({ error: "chat_id required" }, { status: 400 });

  const chat = await queryOne<{
    email: string | null;
    first_name: string | null;
    messages: ChatMessage[];
  }>("SELECT email, first_name, messages FROM concierge_chats WHERE id = $1", [chat_id]).catch(() => null);

  if (!chat || !chat.email) return NextResponse.json({ error: "no email on this chat" }, { status: 404 });

  // Take last show_matches action
  const lastMatchAction = (chat.messages || [])
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.action?.type === "show_matches");
  const reasoned = (lastMatchAction?.action?.data?.matches || []).map((m) => ({
    slug: m.slug,
    reasoning: m.reasoning,
  }));
  if (reasoned.length === 0) return NextResponse.json({ error: "no matches yet" }, { status: 400 });

  const slugs = reasoned.map((r) => r.slug);
  const rows = await query<{
    slug: string; name: string; rating: string; review_count: number;
    min_price: string | null; sample_url: string | null; cover_url: string | null; locations: string[] | null;
  }>(
    `SELECT pp.slug, u.name,
            COALESCE(pp.rating, 0)::text AS rating,
            COALESCE(pp.review_count, 0) AS review_count,
            (SELECT MIN(price)::text FROM packages WHERE photographer_id = pp.id) AS min_price,
            (SELECT url FROM portfolio_items WHERE photographer_id = pp.id AND type = 'photo' ORDER BY sort_order, created_at LIMIT 1) AS sample_url,
            pp.cover_url,
            ARRAY(SELECT location_slug FROM photographer_locations WHERE photographer_id = pp.id) AS locations
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE pp.slug = ANY($1) AND pp.is_approved = TRUE`,
    [slugs]
  );

  const cards = slugs.map((slug) => {
    const r = rows.find((x) => x.slug === slug);
    const reasoning = reasoned.find((m) => m.slug === slug)?.reasoning || "";
    if (!r) return null;
    return {
      slug, name: r.name,
      rating: parseFloat(r.rating) || 0,
      review_count: r.review_count,
      min_price: r.min_price ? parseInt(r.min_price) : null,
      sample_url: r.sample_url,
      cover_url: r.cover_url,
      locations: r.locations || [],
      reasoning,
    };
  }).filter(Boolean) as Array<{
    slug: string; name: string; rating: number; review_count: number;
    min_price: number | null; sample_url: string | null; cover_url: string | null;
    locations: string[]; reasoning: string;
  }>;

  if (cards.length === 0) return NextResponse.json({ error: "no valid matches" }, { status: 404 });

  const greeting = chat.first_name ? `Hi ${chat.first_name},` : "Hi,";
  const cardsHtml = cards.map((c) => {
    const imgUrl = c.sample_url || c.cover_url;
    const fullImg = imgUrl?.startsWith("http") ? imgUrl : `https://photoportugal.com${imgUrl}`;
    const locs = c.locations.slice(0, 3).map((l) => l.charAt(0).toUpperCase() + l.slice(1).replace(/-/g, " ")).join(" · ");
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #F3EDE6;border-radius:12px;overflow:hidden;">
      ${imgUrl ? `<tr><td><img src="${fullImg}" alt="${c.name}" width="520" style="display:block;width:100%;max-height:200px;object-fit:cover;"></td></tr>` : ""}
      <tr><td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:16px;font-weight:700;color:#1F1F1F;">${c.name}</td>
            <td align="right" style="font-size:13px;color:#1F1F1F;font-weight:600;white-space:nowrap;">
              ${c.review_count > 0 ? `⭐ ${c.rating.toFixed(1)} <span style="color:#9B8E82;font-weight:400;">(${c.review_count})</span>` : ""}
              ${c.min_price ? ` &nbsp;·&nbsp; from <strong>€${c.min_price}</strong>` : ""}
            </td>
          </tr>
          ${locs ? `<tr><td colspan="2" style="font-size:12px;color:#9B8E82;padding-top:2px;">${locs}</td></tr>` : ""}
        </table>
        <p style="margin:10px 0 12px;font-size:14px;line-height:1.55;color:#4A4A4A;font-style:italic;">"${c.reasoning}"</p>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#C94536;border-radius:8px;">
              <a href="https://photoportugal.com/book/${c.slug}?from=concierge_email" style="display:inline-block;padding:10px 18px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Talk to ${c.name.split(" ")[0]}</a>
            </td>
            <td style="padding-left:8px;">
              <a href="https://photoportugal.com/photographers/${c.slug}?from=concierge_email" style="display:inline-block;padding:10px 16px;color:#4A4A4A;text-decoration:none;font-weight:500;font-size:14px;border:1px solid #E8DFD3;border-radius:8px;">View profile</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
  }).join("");

  const html = emailLayout(`
    <h2 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1F1F1F;">Your refined photographer matches 📸</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">${greeting}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4A4A4A;">Based on your latest preferences, here are your updated 3 matches.</p>
    ${cardsHtml}
    ${emailButton("https://photoportugal.com/concierge", "Continue chatting", "#C94536")}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9B8E82;">Sent because you used our AI concierge.</p>
  `);

  await sendEmail(chat.email, "Your updated Portugal photographer matches", html).catch((e) => console.error("[concierge/email/resend] send error:", e));

  return NextResponse.json({ ok: true, matches_emailed: cards.length });
}
