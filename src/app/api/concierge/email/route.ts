import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { emailLayout, emailButton, sendEmail } from "@/lib/email";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; data: { matches?: Array<{ slug: string; reasoning: string }> } } | null;
}

export async function POST(req: NextRequest) {
  const { chat_id, email, first_name } = await req.json().catch(() => ({}));
  if (!chat_id || !email) return NextResponse.json({ error: "chat_id and email required" }, { status: 400 });
  const trimmed = String(email).trim().toLowerCase();
  if (!trimmed.includes("@")) return NextResponse.json({ error: "invalid email" }, { status: 400 });

  const updated = await queryOne<{ id: string; matched_photographer_ids: string[] | null; messages: ChatMessage[] }>(
    `UPDATE concierge_chats SET email = $1, first_name = COALESCE($2, first_name), updated_at = NOW()
     WHERE id = $3 RETURNING id, matched_photographer_ids, messages`,
    [trimmed, first_name || null, chat_id]
  ).catch(() => null);

  if (!updated) return NextResponse.json({ error: "chat not found" }, { status: 404 });

  // Look up chat language for localizing the email
  const chatMeta = await queryOne<{ language: string | null }>(
    "SELECT language FROM concierge_chats WHERE id = $1",
    [chat_id]
  ).catch(() => null);
  const lang = (chatMeta?.language || "en").slice(0, 2);
  const isPt = lang === "pt";
  const isDe = lang === "de";

  // Find the most recent show_matches action with reasoning per slug
  const lastMatchAction = (updated.messages || [])
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.action?.type === "show_matches");
  const reasonedSlugs: { slug: string; reasoning: string }[] = (lastMatchAction?.action?.data?.matches || []).map((m) => ({
    slug: m.slug,
    reasoning: m.reasoning,
  }));

  // Hydrate full photographer info from DB for the email
  let cards: Array<{ slug: string; name: string; tagline: string | null; rating: number; review_count: number; min_price: number | null; sample_url: string | null; cover_url: string | null; locations: string[]; reasoning: string }> = [];
  if (reasonedSlugs.length > 0) {
    const slugs = reasonedSlugs.map((m) => m.slug);
    const rows = await query<{
      slug: string; name: string; tagline: string | null; rating: string; review_count: number;
      min_price: string | null; sample_url: string | null; cover_url: string | null; locations: string[] | null;
    }>(
      `SELECT pp.slug, u.name, pp.tagline,
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
    cards = slugs
      .map((slug) => {
        const r = rows.find((x) => x.slug === slug);
        const reasoning = reasonedSlugs.find((m) => m.slug === slug)?.reasoning || "";
        if (!r) return null;
        return {
          slug,
          name: r.name,
          tagline: r.tagline,
          rating: parseFloat(r.rating) || 0,
          review_count: r.review_count,
          min_price: r.min_price ? parseInt(r.min_price) : null,
          sample_url: r.sample_url,
          cover_url: r.cover_url,
          locations: r.locations || [],
          reasoning,
        };
      })
      .filter(Boolean) as typeof cards;
  }

  // Build and send email asynchronously (don't block response)
  if (cards.length > 0) {
    // Localized strings per chat language (EN/PT/DE — others fall back to EN)
    const T = isDe
      ? {
          subject: "Ihre 3 Fotografen-Matches in Portugal",
          h2: "Ihre Fotografen-Matches in Portugal 📸",
          greeting: first_name ? `Hallo ${first_name},` : "Hallo,",
          intro: "Basierend auf Ihren Angaben an unseren Concierge — hier sind Ihre 3 handverlesenen Matches. Tippen Sie auf einen der Profile, um ein Gespräch zu starten — meist antworten sie innerhalb weniger Stunden.",
          talk: (n: string) => `Mit ${n} schreiben`,
          view: "Profil ansehen",
          from: "ab",
          reviews: (n: number) => `(${n})`,
          refine: "Möchten Sie Ihre Matches verfeinern oder mit einem Menschen sprechen? Antworten Sie einfach auf diese E-Mail.",
          continueBtn: "Chat fortsetzen",
          footer: "Sie erhalten diese E-Mail, weil Sie unseren KI-Concierge verwendet haben. Falls das nicht Sie waren, ignorieren Sie diese Nachricht.",
        }
      : isPt
      ? {
          subject: "Os seus 3 fotógrafos em Portugal",
          h2: "Os seus fotógrafos em Portugal 📸",
          greeting: first_name ? `Olá ${first_name},` : "Olá,",
          intro: "Com base no que partilhou com o nosso concierge, aqui estão os seus 3 fotógrafos selecionados. Toque num para iniciar uma conversa — geralmente respondem em poucas horas.",
          talk: (n: string) => `Falar com ${n}`,
          view: "Ver perfil",
          from: "desde",
          reviews: (n: number) => `(${n})`,
          refine: "Quer refinar as suas opções ou falar com um humano? Basta responder a este email.",
          continueBtn: "Continuar conversa",
          footer: "Recebeu este email porque usou o nosso concierge IA. Se não foi você, ignore esta mensagem.",
        }
      : {
          subject: "Your 3 Portugal photographer matches",
          h2: "Your Portugal photographer matches 📸",
          greeting: first_name ? `Hi ${first_name},` : "Hi,",
          intro: "Based on what you told our concierge, here are your 3 hand-picked matches. Tap any one to start a conversation — they'll usually reply within a few hours.",
          talk: (n: string) => `Talk to ${n}`,
          view: "View profile",
          from: "from",
          reviews: (n: number) => `(${n})`,
          refine: "Want to refine your matches or chat with a human? Just reply to this email.",
          continueBtn: "Continue chatting",
          footer: "Sent because you used our AI concierge. If this wasn't you, ignore this email.",
        };

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
                ${c.review_count > 0 ? `⭐ ${c.rating.toFixed(1)} <span style="color:#9B8E82;font-weight:400;">${T.reviews(c.review_count)}</span>` : ""}
                ${c.min_price ? ` &nbsp;·&nbsp; ${T.from} <strong>€${c.min_price}</strong>` : ""}
              </td>
            </tr>
            ${locs ? `<tr><td colspan="2" style="font-size:12px;color:#9B8E82;padding-top:2px;">${locs}</td></tr>` : ""}
          </table>
          <p style="margin:10px 0 12px;font-size:14px;line-height:1.55;color:#4A4A4A;font-style:italic;">"${c.reasoning}"</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C94536;border-radius:8px;">
                <a href="https://photoportugal.com/${lang === "en" ? "" : lang + "/"}book/${c.slug}?from=concierge_email" style="display:inline-block;padding:10px 18px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${T.talk(c.name.split(" ")[0])}</a>
              </td>
              <td style="padding-left:8px;">
                <a href="https://photoportugal.com/${lang === "en" ? "" : lang + "/"}photographers/${c.slug}?from=concierge_email" style="display:inline-block;padding:10px 16px;color:#4A4A4A;text-decoration:none;font-weight:500;font-size:14px;border:1px solid #E8DFD3;border-radius:8px;">${T.view}</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>`;
    }).join("");

    const html = emailLayout(`
      <h2 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.greeting}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.intro}</p>
      ${cardsHtml}
      <p style="margin:20px 0 4px;font-size:14px;line-height:1.55;color:#4A4A4A;">${T.refine}</p>
      ${emailButton(`https://photoportugal.com/${lang === "en" ? "" : lang + "/"}concierge`, T.continueBtn, "#C94536")}
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9B8E82;">${T.footer}</p>
    `);

    sendEmail(trimmed, T.subject, html).catch((e) => console.error("[concierge/email] send error:", e));
  }

  // Notify admin via Telegram with rich context
  try {
    const { sendTelegram } = await import("@/lib/telegram");
    // Pull context: first user message, UTM, country, language
    const ctx = await queryOne<{ messages: ChatMessage[]; utm_source: string | null; utm_medium: string | null; utm_term: string | null; country: string | null; language: string | null }>(
      "SELECT messages, utm_source, utm_medium, utm_term, country, language FROM concierge_chats WHERE id = $1",
      [chat_id]
    ).catch(() => null);
    const firstUserMsg = ctx?.messages?.find((m) => m.role === "user")?.content || "";
    const userMsgPreview = firstUserMsg.length > 200 ? firstUserMsg.slice(0, 200) + "…" : firstUserMsg;
    const cardsList = cards.map((c) => `  • <a href="https://photoportugal.com/photographers/${c.slug}">${c.name}</a>`).join("\n");
    const sourceParts = [
      ctx?.utm_source ? `utm_source: ${ctx.utm_source}` : null,
      ctx?.utm_medium ? `utm_medium: ${ctx.utm_medium}` : null,
      ctx?.utm_term ? `kw: "${ctx.utm_term}"` : null,
      ctx?.country ? `country: ${ctx.country}` : null,
      ctx?.language ? `lang: ${ctx.language}` : null,
    ].filter(Boolean).join(" · ");

    await sendTelegram(
      `🤖 <b>Concierge: email captured</b> 💌\n\n` +
      `<b>Email:</b> ${trimmed}\n` +
      (first_name ? `<b>Name:</b> ${first_name}\n` : "") +
      (userMsgPreview ? `\n<b>What they asked:</b>\n<i>"${userMsgPreview}"</i>\n` : "") +
      (cards.length > 0 ? `\n<b>Matches sent (${cards.length}):</b>\n${cardsList}\n` : "") +
      (sourceParts ? `\n<b>Source:</b> ${sourceParts}\n` : "") +
      `\n<a href="https://photoportugal.com/admin?tab=concierge#concierge-${chat_id}">Open chat in admin</a>`,
      "clients"
    ).catch(() => {});
  } catch (err) {
    console.error("[concierge/email] telegram error:", err);
  }

  return NextResponse.json({ ok: true, matches_emailed: cards.length });
}
