import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendCancellationMessage } from "@/lib/booking-messages";

export const dynamic = "force-dynamic";

/**
 * Cancel an UNPAID booking. Either party (photographer or client) can do
 * this — paid bookings go through the refund/dispute flow instead.
 *
 * Body: { reason: string }  // required, 5-500 chars, free-text from
 *                              the canceller — surfaced to the other party
 *                              by email, to admins via Telegram, and into
 *                              the chat as a system message.
 *
 * Returns 200 + { success: true } on success.
 * Returns 400 with { code, error } on validation issues.
 * Returns 403 if the caller isn't the photographer or client of the booking.
 * Returns 409 if the booking is already paid (use refund flow) or already
 *   cancelled / completed (no-op).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { reason?: unknown } = {};
  try { body = await req.json(); } catch {}
  const reason = String(body.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json({
      error: "Please tell the other side why — at least a few words.",
      code: "reason_required",
    }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({
      error: "Reason is too long (max 500 characters).",
      code: "reason_too_long",
    }, { status: 400 });
  }

  // Pull booking + parties + photographer slug for the email/Telegram payload.
  const booking = await queryOne<{
    id: string;
    status: string;
    payment_status: string;
    client_id: string;
    photographer_id: string;
    photographer_user_id: string;
    photographer_name: string;
    photographer_email: string;
    photographer_slug: string;
    client_name: string;
    client_email: string;
    shoot_date: string | null;
    total_price: string | null;
    gift_card_id: string | null;
  }>(
    `SELECT b.id, b.status, b.payment_status, b.client_id, b.photographer_id,
            pu.id as photographer_user_id, pu.name as photographer_name,
            pu.email as photographer_email, pp.slug as photographer_slug,
            cu.name as client_name, cu.email as client_email,
            b.shoot_date, b.total_price::text,
            b.gift_card_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     JOIN users cu ON cu.id = b.client_id
     WHERE b.id = $1`,
    [id]
  );
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Authorisation: only the booking's photographer or client can cancel.
  const isPhotographer = booking.photographer_user_id === user.id;
  const isClient = booking.client_id === user.id;
  if (!isPhotographer && !isClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cancelledBy: "photographer" | "client" = isPhotographer ? "photographer" : "client";

  // State guards. Only unpaid + not-yet-cancelled bookings.
  // Exception: a gift-card-redeemed booking is `payment_status='paid'` from
  // creation (the card paid for it). Cancellation is still allowed because
  // it doesn't trigger a refund — instead the card flips back to 'claimed'
  // (handled below) and the recipient can pick another photographer.
  if (booking.payment_status === "paid" && !booking.gift_card_id) {
    return NextResponse.json({
      error: "This booking is already paid — please request a refund or open a dispute instead.",
      code: "already_paid",
    }, { status: 409 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ success: true, alreadyCancelled: true });
  }
  if (booking.status === "completed" || booking.status === "delivered") {
    return NextResponse.json({
      error: "Cannot cancel a completed or delivered booking.",
      code: "already_completed",
    }, { status: 409 });
  }

  // Apply the cancellation.
  await queryOne(
    `UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW(),
         cancelled_by = $1, cancelled_reason = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [cancelledBy, reason, id]
  );

  // Cancel-restore for gift-card bookings: when the photographer cancels,
  // restore the gift card to `claimed`, extend expiry +30 days (or back
  // to original if it had already crossed), reattach active_gift_card_id
  // on the recipient, and notify them by email so they can pick someone
  // else. Client-side cancels (recipient changed mind) also restore the
  // card so they aren't stuck.
  if (booking.gift_card_id) {
    try {
      await queryOne(
        `UPDATE gift_cards
            SET status = 'claimed',
                booking_id = NULL,
                redeemed_at = NULL,
                expires_at = GREATEST(expires_at, NOW() + INTERVAL '30 days')
          WHERE id = $1 AND status = 'redeemed' RETURNING id`,
        [booking.gift_card_id]
      );
      // Re-attach to recipient so the next browse session is gift-mode.
      const recipUser = await queryOne<{ recipient_user_id: string | null }>(
        "SELECT recipient_user_id FROM gift_cards WHERE id = $1",
        [booking.gift_card_id]
      );
      if (recipUser?.recipient_user_id) {
        await queryOne(
          "UPDATE users SET active_gift_card_id = $1 WHERE id = $2 RETURNING id",
          [booking.gift_card_id, recipUser.recipient_user_id]
        );
      }
      // Best-effort restore email — different copy for photographer vs
      // client cancel. When the recipient cancelled themselves they
      // already know; we just acknowledge the gift is back. When the
      // photographer cancelled, we explain + nudge them to pick another.
      try {
        const { sendEmail, emailLayout, emailButton } = await import("@/lib/email");
        const { getUserLocaleById, pickT, normalizeLocale } = await import("@/lib/email-locale");
        if (recipUser?.recipient_user_id && cancelledBy === "photographer") {
          const loc = normalizeLocale(await getUserLocaleById(recipUser.recipient_user_id));
          const firstName = booking.photographer_name.split(" ")[0] || booking.photographer_name;
          const T = pickT({
            en: { subject: `Your gift session is restored`, h2: `${booking.photographer_name} had to cancel`, body: `Sorry — ${firstName} had to cancel your gift session. Your gift card is back in your account with an extra 30 days to redeem. Pick another photographer below.`, cta: "Pick another photographer" },
            pt: { subject: `A sua sessão de presente foi restaurada`, h2: `${booking.photographer_name} teve de cancelar`, body: `Lamentamos — ${firstName} teve de cancelar a sua sessão. O cartão-presente está de volta na sua conta com mais 30 dias para utilizar. Escolha outro fotógrafo.`, cta: "Escolher outro fotógrafo" },
            de: { subject: `Ihre Geschenk-Session wurde wiederhergestellt`, h2: `${booking.photographer_name} musste absagen`, body: `Es tut uns leid — ${firstName} musste Ihre Session absagen. Ihre Geschenkkarte ist wieder in Ihrem Konto mit 30 zusätzlichen Tagen. Wählen Sie einen anderen Fotografen.`, cta: "Anderen Fotografen wählen" },
            es: { subject: `Su sesión de regalo ha sido restaurada`, h2: `${booking.photographer_name} tuvo que cancelar`, body: `Lo sentimos — ${firstName} tuvo que cancelar su sesión. Su tarjeta de regalo está de nuevo en su cuenta con 30 días adicionales. Elija otro fotógrafo.`, cta: "Elegir otro fotógrafo" },
            fr: { subject: `Votre séance cadeau est rétablie`, h2: `${booking.photographer_name} a dû annuler`, body: `Désolé — ${firstName} a dû annuler votre séance. Votre carte cadeau est de retour dans votre compte avec 30 jours supplémentaires. Choisissez un autre photographe.`, cta: "Choisir un autre photographe" },
          }, loc);
          const html = emailLayout(`
            <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
            ${emailButton("https://photoportugal.com/photographers", T.cta)}
          `, loc);
          await sendEmail(booking.client_email, T.subject, html);
        }
        // Client cancelled themselves — no restore email needed (they
        // initiated the action and already know). active_gift_card_id
        // and card status are still restored above so they can re-pick.
      } catch (mailErr) {
        console.error("[cancel] gift-card restore email error:", mailErr);
      }
    } catch (restoreErr) {
      console.error("[cancel] gift-card restore error:", restoreErr);
    }
  }

  // System message in the existing chat — fire-and-forget. Chat lives
  // independently of the booking lifecycle (booking_id is now ON DELETE
  // SET NULL, never CASCADE), so this message persists even if the
  // booking is later hard-deleted.
  sendCancellationMessage(id, cancelledBy, reason, user.id).catch(() => {});

  // Email the OTHER side with the reason, in plain language.
  import("@/lib/email").then(async ({ sendEmail, emailLayout, emailButton }) => {
    const { formatShootDate } = await import("@/lib/format-shoot-date");
    const { getUserLocaleByEmail } = await import("@/lib/email-locale");
    const recipientEmail = cancelledBy === "photographer" ? booking.client_email : booking.photographer_email;
    const recipientLocale = await getUserLocaleByEmail(recipientEmail);
    const cancellerName = cancelledBy === "photographer" ? booking.photographer_name : booking.client_name;
    const otherFirstName = (cancelledBy === "photographer" ? booking.client_name : booking.photographer_name).split(" ")[0] || "there";
    const formattedDate = formatShootDate(booking.shoot_date, recipientLocale);
    const dateLine = formattedDate ? `<p style="margin:0 0 8px;color:#666;">Date: ${formattedDate}</p>` : "";
    const priceLine = booking.total_price ? `<p style="margin:0 0 8px;color:#666;">Amount: €${Math.round(Number(booking.total_price))}</p>` : "";
    const subject = cancelledBy === "photographer"
      ? `Your booking with ${booking.photographer_name} was cancelled`
      : `${booking.client_name} cancelled their booking`;
    sendEmail(recipientEmail, subject,
      emailLayout(`
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${otherFirstName},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${cancellerName}</strong> cancelled the unpaid booking. Their reason:</p>
        <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #C94536;background:#FFF5F2;color:#4A4A4A;font-size:14px;line-height:1.5;font-style:italic;">${reason.replace(/[<>]/g, "")}</blockquote>
        ${dateLine}
        ${priceLine}
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4A4A4A;">If you'd like to reach out — the chat between you stays open.</p>
        ${emailButton(`https://photoportugal.com/dashboard/messages`, "Open conversation")}
      `)
    ).catch((e) => console.error("[bookings/cancel] email error:", e));
  }).catch(() => {});

  // Telegram admins — short structured ping with the full reason.
  import("@/lib/telegram").then(({ sendTelegram }) => {
    const role = cancelledBy === "photographer" ? "photographer" : "client";
    const cancellerName = cancelledBy === "photographer" ? booking.photographer_name : booking.client_name;
    const fmtDate = (d: unknown): string | null => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(String(d));
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    };
    const dateStr = fmtDate(booking.shoot_date);
    const lines: string[] = [
      `❌ <b>Booking cancelled</b>`,
      `<b>By:</b> ${role} (${cancellerName})`,
      `<b>Client:</b> ${booking.client_name}`,
      `<b>Photographer:</b> ${booking.photographer_name}`,
    ];
    if (dateStr) lines.push(`<b>Shoot date:</b> ${dateStr}`);
    if (booking.total_price) lines.push(`<b>Amount:</b> €${Math.round(Number(booking.total_price))}`);
    lines.push(`<b>Reason:</b> <i>${reason.replace(/[<>]/g, "")}</i>`);
    sendTelegram(lines.join("\n"), "bookings").catch(() => {});
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
