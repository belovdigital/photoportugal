import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { sendEmail } from "@/lib/email";
import { locations } from "@/lib/locations-data";
import { resolveAbsoluteImageUrl } from "@/lib/image-url";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Convert plain-text admin note with newlines into paragraphed HTML.
// Double newline → paragraph break, single newline → <br>.
function formatNoteHtml(text: string): string {
  const paragraphs = escapeHtml(text.trim()).split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p style="margin:0 0 10px;font-size:14px;color:#1E40AF;line-height:1.6;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { photographer_prices, admin_comment } = await req.json();

  if (!Array.isArray(photographer_prices) || photographer_prices.length === 0 || photographer_prices.length > 3) {
    return NextResponse.json({ error: "Please provide 1-3 photographers with prices." }, { status: 400 });
  }

  // Validate each entry has id and price
  for (const pp of photographer_prices) {
    if (!pp.id || typeof pp.price !== "number" || pp.price <= 0) {
      return NextResponse.json({ error: "Each photographer must have a valid id and price." }, { status: 400 });
    }
  }

  const photographer_ids = photographer_prices.map((pp: { id: string; price: number }) => pp.id);
  const priceMap = new Map<string, number>(photographer_prices.map((pp: { id: string; price: number }) => [pp.id, pp.price]));

  try {
    const matchReq = await queryOne<{
      id: string; name: string; email: string; phone: string | null; location_slug: string;
      shoot_type: string; shoot_date: string | null; date_flexible: boolean;
      flexible_date_from: string | null; flexible_date_to: string | null;
      shoot_time: string | null; group_size: number; budget_range: string;
      status: string;
    }>(
      "SELECT * FROM match_requests WHERE id = $1",
      [id]
    );

    if (!matchReq) return NextResponse.json({ error: "Match request not found" }, { status: 404 });
    if (matchReq.status !== "new") return NextResponse.json({ error: "Request already matched" }, { status: 400 });

    // Look up photographers by ID
    const photographers = await query<{
      id: string; name: string; slug: string; avatar_url: string | null;
      rating: number; review_count: number;
    }>(
      `SELECT pp.id, u.name, pp.slug, u.avatar_url,
              COALESCE(pp.rating, 0) as rating,
              COALESCE(pp.review_count, 0) as review_count
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ANY($1) AND pp.is_approved = TRUE`,
      [photographer_ids]
    );

    if (photographers.length === 0) {
      return NextResponse.json({ error: "No valid photographers found." }, { status: 400 });
    }

    // Insert selections with prices
    for (const p of photographers) {
      await queryOne(
        "INSERT INTO match_request_photographers (match_request_id, photographer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id, p.id]
      );
      const price = priceMap.get(p.id);
      if (price) {
        await queryOne(
          "UPDATE match_request_photographers SET price = $1 WHERE match_request_id = $2 AND photographer_id = $3",
          [price, id, p.id]
        );
      }
    }

    // Update status and save admin note
    await queryOne(
      "UPDATE match_requests SET status = 'matched', matched_at = NOW(), admin_note = $1 WHERE id = $2",
      [admin_comment?.trim() || null, id]
    );

    // Get prices + bio for email
    const photographerDetails = await Promise.all(
      photographers.map(async (p) => {
        const info = await queryOne<{ min_price: number | null; bio: string | null }>(
          `SELECT (SELECT MIN(price) FROM packages WHERE photographer_id = $1 AND is_public = TRUE) as min_price,
                  pp.bio FROM photographer_profiles pp WHERE pp.id = $1`,
          [p.id]
        );
        return { ...p, min_price: info?.min_price ?? null, bio: info?.bio || null };
      })
    );

    const locationName = locations.find((l) => l.slug === matchReq.location_slug)?.name || matchReq.location_slug;
    const shootTypeLabel = matchReq.shoot_type
      ? matchReq.shoot_type.charAt(0).toUpperCase() + matchReq.shoot_type.slice(1)
      : "Photoshoot";
    const firstName = matchReq.name.trim().split(" ")[0];

    // Format date for email
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    let dateStr = "Flexible dates";
    if (matchReq.date_flexible && matchReq.flexible_date_from) {
      dateStr = `${fmtDate(matchReq.flexible_date_from)} – ${fmtDate(matchReq.flexible_date_to)}`;
    } else if (matchReq.shoot_date) {
      dateStr = fmtDate(matchReq.shoot_date);
    }

    // Build photographer cards (table-based for email compatibility)
    const photographerCards = photographerDetails.map((p) => {
      const avatarUrl = resolveAbsoluteImageUrl(p.avatar_url, BASE_URL) || `${BASE_URL}/favicon.svg`;
      const assignedPrice = priceMap.get(p.id);
      const priceText = assignedPrice ? `€${assignedPrice} for your session` : "";
      const reviewCount = Number(p.review_count);
      const ratingStars = "★".repeat(Math.round(Number(p.rating))) + "☆".repeat(5 - Math.round(Number(p.rating)));
      const ratingHtml = reviewCount > 0
        ? `<p style="margin:4px 0 0;font-size:13px;color:#C94536;">${ratingStars} <span style="color:#666;">${Number(p.rating).toFixed(1)} · ${reviewCount} review${reviewCount !== 1 ? "s" : ""}</span></p>`
        : "";
      const bioSnippet = p.bio ? escapeHtml(p.bio.slice(0, 120)) + (p.bio.length > 120 ? "..." : "") : "";

      return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:12px;overflow:hidden;border:1px solid #F3EDE6;">
        <tr><td style="padding:20px;background:#FAF8F5;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="72" valign="top">
                <img src="${avatarUrl}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;" alt="${escapeHtml(p.name)}" />
              </td>
              <td style="padding-left:16px;" valign="top">
                <p style="margin:0;font-size:18px;font-weight:700;color:#1F1F1F;">${escapeHtml(p.name)}</p>
                ${ratingHtml}
                ${priceText ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#333;">${priceText}</p>` : ""}
                ${bioSnippet ? `<p style="margin:8px 0 0;font-size:13px;color:#666;line-height:1.5;">${bioSnippet}</p>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>
      </table>`;
    }).join("");

    // Admin personal note
    const adminNoteHtml = admin_comment?.trim()
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="padding:16px 20px;background:#EEF6FF;border-radius:10px;border:1px solid #DBEAFE;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:0.5px;">A Note From Our Team</p>
            ${formatNoteHtml(admin_comment)}
          </td></tr>
        </table>`
      : "";

    const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:32px 0 24px;text-align:center;">
          <img src="${BASE_URL}/logo.svg" alt="Photo Portugal" width="160" style="width:160px;" />
        </td></tr>
      </table>

      <!-- Title -->
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#1F1F1F;text-align:center;">Your Photographer Matches</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#888;text-align:center;">Hand-picked for your ${escapeHtml(shootTypeLabel)} session in ${escapeHtml(locationName)}</p>

      <!-- Intro -->
      <p style="font-size:15px;line-height:1.7;color:#4A4A4A;">Hi ${escapeHtml(firstName)},</p>
      <p style="font-size:15px;line-height:1.7;color:#4A4A4A;">Thank you for trusting Photo Portugal with your photoshoot! Our concierge team has reviewed your request, personally reached out to ${photographerDetails.length} photographer${photographerDetails.length > 1 ? "s" : ""}, and confirmed ${photographerDetails.length > 1 ? "they are all" : "they are"} available for your date and a great fit for your ${escapeHtml(shootTypeLabel.toLowerCase())} session.</p>

      <!-- Request summary -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #F3EDE6;">
        <tr><td style="padding:16px 20px;background:#FEFCFB;">
          <p style="margin:0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Your Request</p>
          <p style="margin:8px 0 0;font-size:14px;color:#4A4A4A;">📍 ${escapeHtml(locationName)} · 📅 ${escapeHtml(dateStr)} · 👥 ${matchReq.group_size} people · 💰 €${escapeHtml(matchReq.budget_range ? matchReq.budget_range.replace("-", "–") : "—")}</p>
        </td></tr>
      </table>

      ${adminNoteHtml}

      <!-- Photographer cards -->
      <p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Your Matches</p>
      ${photographerCards}

      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#C94536;border-radius:10px;">
              <a href="${BASE_URL}/dashboard/match-requests" style="display:inline-block;padding:16px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;">View Your Matches & Choose →</a>
            </td></tr>
          </table>
        </td></tr>
      </table>

      <!-- How to book -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:10px;overflow:hidden;border:1px solid #F3EDE6;">
        <tr><td style="padding:20px;background:#FEFCFB;">
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1F1F1F;">How to book</p>
          <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">Click the button above to view your matched photographers, browse their portfolios, and complete your booking — it takes less than 2 minutes. Your payment is protected until your photos are delivered.</p>
        </td></tr>
      </table>

      <!-- Need help -->
      <p style="font-size:14px;color:#666;line-height:1.6;">Can't decide? Simply reply to this email — our team is happy to help you choose the best fit for your session.</p>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-top:1px solid #F3EDE6;">
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#999;">Photo Portugal — Connecting travelers with talented photographers across Portugal</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;"><a href="${BASE_URL}" style="color:#C94536;text-decoration:none;">photoportugal.com</a></p>
        </td></tr>
      </table>
    </div>`;

    sendEmail(
      matchReq.email,
      `${firstName}, your ${shootTypeLabel.toLowerCase()} photographer matches in ${locationName} are ready`,
      emailHtml
    ).catch((err) => console.error("[send-matches] email error:", err));

    // SMS to client
    if (matchReq.phone) {
      const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
      const cLocale = await getUserLocaleByEmail(matchReq.email);
      const smsBody = pickT({
        en: `Hi ${firstName}! Your photographer matches for ${locationName} are ready. Check them out and choose your favorite: ${BASE_URL}/dashboard/match-requests`,
        pt: `Olá ${firstName}! Os seus fotógrafos para ${locationName} estão prontos. Veja e escolha o seu favorito: ${BASE_URL}/dashboard/match-requests`,
        de: `Hallo ${firstName}! Ihre Fotografen für ${locationName} sind bereit. Sehen Sie sie an und wählen Sie Ihren Favoriten: ${BASE_URL}/dashboard/match-requests`,
        fr: `Bonjour ${firstName} ! Vos photographes pour ${locationName} sont prêts. Découvrez-les et choisissez votre favori : ${BASE_URL}/dashboard/match-requests`,
      }, cLocale);
      import("@/lib/sms").then(({ sendSMS }) => {
        sendSMS(matchReq.phone!, smsBody);
      }).catch((err) => console.error("[send-matches] client sms error:", err));
    }

    // Notify matched photographers that they were recommended
    const { getUserLocaleByEmail: getPLocale, pickT: pPickT } = await import("@/lib/email-locale");
    // Determine whether the request has a specific shoot type (vs the generic
    // "Photoshoot" fallback). If specific, render "for a <type> photoshoot in X";
    // otherwise just "for a photoshoot in X" — avoids the "photoshoot photoshoot" dupe.
    const hasSpecificShootType = !!matchReq.shoot_type;
    for (const p of photographers) {
      try {
        const pUser = await queryOne<{ email: string; phone: string | null; user_id: string }>(
          "SELECT u.email, u.phone, u.id as user_id FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id WHERE pp.id = $1",
          [p.id]
        );
        if (pUser) {
          const pLocale = await getPLocale(pUser.email);
          const photogFirst = p.name.split(" ")[0];
          const stLower = shootTypeLabel.toLowerCase();
          const T = pPickT({
            en: {
              subject: `You've been recommended to ${firstName}!`,
              h2: "You've Been Matched!",
              greeting: `Hi ${photogFirst},`,
              body: hasSpecificShootType
                ? `Great news — we've recommended you to <strong>${matchReq.name}</strong> for a ${stLower} photoshoot in ${locationName}.`
                : `Great news — we've recommended you to <strong>${matchReq.name}</strong> for a photoshoot in ${locationName}.`,
              footer: "The client is reviewing your profile now. If they choose you, you'll receive a booking notification with all the details.",
            },
            pt: {
              subject: `Foi recomendado(a) a ${firstName}!`,
              h2: "Foi Selecionado(a)!",
              greeting: `Olá ${photogFirst},`,
              body: hasSpecificShootType
                ? `Boas notícias — recomendámos-lhe a <strong>${matchReq.name}</strong> para uma sessão de ${stLower} em ${locationName}.`
                : `Boas notícias — recomendámos-lhe a <strong>${matchReq.name}</strong> para uma sessão fotográfica em ${locationName}.`,
              footer: "O(a) cliente está a rever o seu perfil. Se o(a) escolher, receberá uma notificação de reserva com todos os detalhes.",
            },
            de: {
              subject: `Sie wurden ${firstName} empfohlen!`,
              h2: "Sie wurden ausgewählt!",
              greeting: `Hallo ${photogFirst},`,
              body: hasSpecificShootType
                ? `Gute Nachrichten — wir haben Sie <strong>${matchReq.name}</strong> für ein ${stLower}-Fotoshooting in ${locationName} empfohlen.`
                : `Gute Nachrichten — wir haben Sie <strong>${matchReq.name}</strong> für ein Fotoshooting in ${locationName} empfohlen.`,
              footer: "Der/die Kunde:in prüft jetzt Ihr Profil. Wenn er/sie Sie wählt, erhalten Sie eine Buchungsbenachrichtigung mit allen Details.",
            },
            es: {
              subject: `¡Le hemos recomendado a ${firstName}!`,
              h2: "¡Ha sido seleccionado(a)!",
              greeting: `Hola ${photogFirst},`,
              body: hasSpecificShootType
                ? `Buenas noticias — le hemos recomendado a <strong>${matchReq.name}</strong> para una sesión de ${stLower} en ${locationName}.`
                : `Buenas noticias — le hemos recomendado a <strong>${matchReq.name}</strong> para una sesión fotográfica en ${locationName}.`,
              footer: "El/la cliente está revisando su perfil. Si le elige, recibirá una notificación de reserva con todos los detalles.",
            },
            fr: {
              subject: `Vous avez été recommandé(e) à ${firstName} !`,
              h2: "Vous avez été sélectionné(e) !",
              greeting: `Bonjour ${photogFirst},`,
              body: hasSpecificShootType
                ? `Bonne nouvelle — nous vous avons recommandé(e) à <strong>${matchReq.name}</strong> pour une séance ${stLower} à ${locationName}.`
                : `Bonne nouvelle — nous vous avons recommandé(e) à <strong>${matchReq.name}</strong> pour une séance photo à ${locationName}.`,
              footer: "Le/la client(e) examine votre profil. S'il/elle vous choisit, vous recevrez une notification de réservation avec tous les détails.",
            },
          }, pLocale);

          sendEmail(
            pUser.email,
            T.subject,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">${T.h2}</h2>
              <p>${T.greeting}</p>
              <p>${T.body}</p>
              <p>${T.footer}</p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          ).catch(() => {});
        }
      } catch {}
    }

    // Telegram
    import("@/lib/telegram").then(({ sendTelegram }) => {
      sendTelegram(
        `✅ <b>Matches Sent!</b>\n\n<b>Client:</b> ${matchReq.name}\n<b>Location:</b> ${locationName}\n<b>Photographers:</b> ${photographers.map((p) => p.name).join(", ")}${admin_comment ? `\n<b>Note:</b> ${admin_comment}` : ""}\n\n<a href="${BASE_URL}/admin#matchRequests">Open Admin →</a>`,
        "match_requests"
      );
    }).catch((err) => console.error("[send-matches] telegram error:", err));

    return NextResponse.json({ success: true, matched_count: photographers.length });
  } catch (error) {
    console.error("[admin/match-request/send-matches] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/match-request/:id/send-matches", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to send matches" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { photographer_prices, admin_comment, resend_email } = await req.json();

  if (!Array.isArray(photographer_prices) || photographer_prices.length === 0 || photographer_prices.length > 3) {
    return NextResponse.json({ error: "Please provide 1-3 photographers with prices." }, { status: 400 });
  }

  for (const pp of photographer_prices) {
    if (!pp.id || typeof pp.price !== "number" || pp.price <= 0) {
      return NextResponse.json({ error: "Each photographer must have a valid id and price." }, { status: 400 });
    }
  }

  const photographer_ids = photographer_prices.map((pp: { id: string; price: number }) => pp.id);
  const priceMap = new Map<string, number>(photographer_prices.map((pp: { id: string; price: number }) => [pp.id, pp.price]));

  try {
    const matchReq = await queryOne<{
      id: string; name: string; email: string; phone: string | null; location_slug: string;
      shoot_type: string; shoot_date: string | null; date_flexible: boolean;
      flexible_date_from: string | null; flexible_date_to: string | null;
      shoot_time: string | null; group_size: number; budget_range: string;
      status: string;
    }>(
      "SELECT * FROM match_requests WHERE id = $1",
      [id]
    );

    if (!matchReq) return NextResponse.json({ error: "Match request not found" }, { status: 404 });
    if (matchReq.status !== "matched") return NextResponse.json({ error: "Request must be in 'matched' status to edit." }, { status: 400 });

    // Look up photographers by ID
    const photographers = await query<{
      id: string; name: string; slug: string; avatar_url: string | null;
      rating: number; review_count: number;
    }>(
      `SELECT pp.id, u.name, pp.slug, u.avatar_url,
              COALESCE(pp.rating, 0) as rating,
              COALESCE(pp.review_count, 0) as review_count
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ANY($1) AND pp.is_approved = TRUE`,
      [photographer_ids]
    );

    if (photographers.length === 0) {
      return NextResponse.json({ error: "No valid photographers found." }, { status: 400 });
    }

    // Delete existing match_request_photographers rows
    await query("DELETE FROM match_request_photographers WHERE match_request_id = $1", [id]);

    // Insert new selections with prices
    for (const p of photographers) {
      await queryOne(
        "INSERT INTO match_request_photographers (match_request_id, photographer_id, price) VALUES ($1, $2, $3)",
        [id, p.id, priceMap.get(p.id) || 0]
      );
    }

    // Update admin note if provided
    if (admin_comment !== undefined) {
      await queryOne(
        "UPDATE match_requests SET admin_note = $1 WHERE id = $2",
        [admin_comment?.trim() || null, id]
      );
    }

    // Resend email if requested
    if (resend_email) {
      const photographerDetails = await Promise.all(
        photographers.map(async (p) => {
          const info = await queryOne<{ min_price: number | null; bio: string | null }>(
            `SELECT (SELECT MIN(price) FROM packages WHERE photographer_id = $1 AND is_public = TRUE) as min_price,
                    pp.bio FROM photographer_profiles pp WHERE pp.id = $1`,
            [p.id]
          );
          return { ...p, min_price: info?.min_price ?? null, bio: info?.bio || null };
        })
      );

      const locationName = locations.find((l) => l.slug === matchReq.location_slug)?.name || matchReq.location_slug;
      const shootTypeLabel = matchReq.shoot_type
      ? matchReq.shoot_type.charAt(0).toUpperCase() + matchReq.shoot_type.slice(1)
      : "Photoshoot";
      const firstName = matchReq.name.trim().split(" ")[0];

      const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      let dateStr = "Flexible dates";
      if (matchReq.date_flexible && matchReq.flexible_date_from) {
        dateStr = `${fmtDate(matchReq.flexible_date_from)} – ${fmtDate(matchReq.flexible_date_to)}`;
      } else if (matchReq.shoot_date) {
        dateStr = fmtDate(matchReq.shoot_date);
      }

      const photographerCards = photographerDetails.map((p) => {
        const avatarUrl = p.avatar_url
          ? (p.avatar_url.startsWith("http") ? p.avatar_url : `${BASE_URL}/api/img/${p.avatar_url.replace("/uploads/", "")}?w=128&q=80&f=webp`)
          : `${BASE_URL}/favicon.svg`;
        const assignedPrice = priceMap.get(p.id);
        const priceText = assignedPrice ? `€${assignedPrice} for your session` : "";
        const reviewCount = Number(p.review_count);
        const ratingStars = "★".repeat(Math.round(Number(p.rating))) + "☆".repeat(5 - Math.round(Number(p.rating)));
        const ratingHtml = reviewCount > 0
          ? `<p style="margin:4px 0 0;font-size:13px;color:#C94536;">${ratingStars} <span style="color:#666;">${Number(p.rating).toFixed(1)} · ${reviewCount} review${reviewCount !== 1 ? "s" : ""}</span></p>`
          : "";
        const bioSnippet = p.bio ? escapeHtml(p.bio.slice(0, 120)) + (p.bio.length > 120 ? "..." : "") : "";

        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:12px;overflow:hidden;border:1px solid #F3EDE6;">
          <tr><td style="padding:20px;background:#FAF8F5;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="72" valign="top">
                  <img src="${avatarUrl}" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;" alt="${escapeHtml(p.name)}" />
                </td>
                <td style="padding-left:16px;" valign="top">
                  <p style="margin:0;font-size:18px;font-weight:700;color:#1F1F1F;">${escapeHtml(p.name)}</p>
                  ${ratingHtml}
                  ${priceText ? `<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#333;">${priceText}</p>` : ""}
                  ${bioSnippet ? `<p style="margin:8px 0 0;font-size:13px;color:#666;line-height:1.5;">${bioSnippet}</p>` : ""}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>`;
      }).join("");

      const adminNoteHtml = admin_comment?.trim()
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="padding:16px 20px;background:#EEF6FF;border-radius:10px;border:1px solid #DBEAFE;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#3B82F6;text-transform:uppercase;letter-spacing:0.5px;">A Note From Our Team</p>
              <p style="margin:0;font-size:14px;color:#1E40AF;line-height:1.6;">${escapeHtml(admin_comment.trim())}</p>
            </td></tr>
          </table>`
        : "";

      const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:32px 0 24px;text-align:center;">
            <img src="${BASE_URL}/logo.svg" alt="Photo Portugal" width="160" style="width:160px;" />
          </td></tr>
        </table>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#1F1F1F;text-align:center;">Updated Photographer Matches</h1>
        <p style="margin:0 0 24px;font-size:15px;color:#888;text-align:center;">Updated picks for your ${escapeHtml(shootTypeLabel)} session in ${escapeHtml(locationName)}</p>
        <p style="font-size:15px;line-height:1.7;color:#4A4A4A;">Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:15px;line-height:1.7;color:#4A4A4A;">We've updated your photographer matches for your upcoming session. Please review the updated selection below.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #F3EDE6;">
          <tr><td style="padding:16px 20px;background:#FEFCFB;">
            <p style="margin:0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Your Request</p>
            <p style="margin:8px 0 0;font-size:14px;color:#4A4A4A;">📍 ${escapeHtml(locationName)} · 📅 ${escapeHtml(dateStr)} · 👥 ${matchReq.group_size} people · 💰 €${escapeHtml(matchReq.budget_range ? matchReq.budget_range.replace("-", "–") : "—")}</p>
          </td></tr>
        </table>
        ${adminNoteHtml}
        <p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Your Updated Matches</p>
        ${photographerCards}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr><td align="center">
            <table cellpadding="0" cellspacing="0">
              <tr><td style="background:#C94536;border-radius:10px;">
                <a href="${BASE_URL}/dashboard/match-requests" style="display:inline-block;padding:16px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;">View Your Matches & Choose →</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <p style="font-size:14px;color:#666;line-height:1.6;">Can't decide? Simply reply to this email — our team is happy to help you choose the best fit for your session.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-top:1px solid #F3EDE6;">
          <tr><td style="padding:24px 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;">Photo Portugal — Connecting travelers with talented photographers across Portugal</p>
            <p style="margin:4px 0 0;font-size:12px;color:#999;"><a href="${BASE_URL}" style="color:#C94536;text-decoration:none;">photoportugal.com</a></p>
          </td></tr>
        </table>
      </div>`;

      sendEmail(
        matchReq.email,
        `${firstName}, your updated photographer matches in ${locationName}`,
        emailHtml
      ).catch((err) => console.error("[send-matches] PATCH email error:", err));

      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(
          `✏️ <b>Matches Updated!</b>\n\n<b>Client:</b> ${matchReq.name}\n<b>Location:</b> ${locationName}\n<b>Photographers:</b> ${photographers.map((p) => p.name).join(", ")}${admin_comment ? `\n<b>Note:</b> ${admin_comment}` : ""}\n<b>Email resent:</b> Yes\n\n<a href="${BASE_URL}/admin#matchRequests">Open Admin →</a>`,
          "match_requests"
        );
      }).catch((err) => console.error("[send-matches] PATCH telegram error:", err));
    }

    return NextResponse.json({ success: true, updated_count: photographers.length });
  } catch (error) {
    console.error("[admin/match-request/send-matches] PATCH error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/match-request/:id/send-matches", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to update matches" }, { status: 500 });
  }
}
