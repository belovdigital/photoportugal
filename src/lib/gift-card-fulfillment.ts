import { queryOne } from "@/lib/db";
import { sendGiftCardEmail, sendGiftCardBuyerReceipt, buildGiftCardSms } from "@/lib/gift-card-email";
import { sendSMS } from "@/lib/sms";
import { isGiftCardTier } from "@/lib/gift-card";

/**
 * Webhook-side handler for `payment_intent.succeeded` on a gift card
 * checkout. Idempotent — running it twice on the same card produces no
 * extra email. We use the `status` column as the latch.
 *
 *   purchased → sent     (this function does the transition)
 *   sent      → claimed  (recipient signs in)
 *   claimed   → redeemed (recipient books)
 *
 * Re-entrancy is safe: the UPDATE that flips `purchased` → `sent` only
 * matches when status was still `purchased`. A parallel webhook delivery
 * gets 0 rows updated and returns without sending.
 */
export async function handleGiftCardPaymentSuccess(giftCardId: string, paymentIntentId: string): Promise<void> {
  // Pull the row + buyer locale for the email language.
  const card = await queryOne<{
    id: string;
    code: string;
    tier: string;
    amount: string;
    status: string;
    recipient_name: string;
    recipient_email: string;
    recipient_phone: string | null;
    recipient_user_id: string | null;
    buyer_name: string;
    buyer_email: string;
    buyer_user_id: string | null;
    personal_message: string | null;
    expires_at: string;
  }>(
    `SELECT id, code, tier, amount::text, status, recipient_name, recipient_email, recipient_phone,
            recipient_user_id, buyer_name, buyer_email, buyer_user_id,
            personal_message, expires_at
       FROM gift_cards WHERE id = $1`,
    [giftCardId]
  );
  if (!card) {
    console.warn("[gift-card-fulfillment] no card row for", giftCardId);
    return;
  }

  // Already delivered — skip. Webhook retries or manual re-fires shouldn't
  // re-spam the recipient.
  if (card.status !== "purchased") {
    console.log(`[gift-card-fulfillment] skip ${giftCardId} — status=${card.status}`);
    return;
  }

  // Recipient dormant-user resolution: same as gift-booking flow. Lookup
  // by email; create dormant row if absent.
  let recipientUserId = card.recipient_user_id;
  if (!recipientUserId) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [card.recipient_email.toLowerCase()]
    );
    if (existing) {
      recipientUserId = existing.id;
    } else {
      const firstName = card.recipient_name.split(" ")[0];
      const lastName = card.recipient_name.split(" ").slice(1).join(" ");
      // Inherit the buyer's locale when we can — falls back to en otherwise.
      const buyerLocale = card.buyer_user_id
        ? await queryOne<{ locale: string | null }>("SELECT locale FROM users WHERE id = $1", [card.buyer_user_id])
        : null;
      const created = await queryOne<{ id: string }>(
        // email_verified=TRUE: clients are verified from birth (platform
        // policy 2026-07-06) — an unverified auto-account is a permanent
        // lockout, since nobody ever emails these users a verify link.
        `INSERT INTO users (email, name, first_name, last_name, role, locale, email_verified, password_hash)
         VALUES ($1, $2, $3, $4, 'client', $5, TRUE, NULL)
         RETURNING id`,
        [card.recipient_email.toLowerCase(), card.recipient_name, firstName, lastName, buyerLocale?.locale || "en"]
      );
      recipientUserId = created?.id || null;
      if (recipientUserId) {
        await queryOne(
          "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [recipientUserId]
        );
      }
    }
  }

  if (!recipientUserId) {
    console.error("[gift-card-fulfillment] failed to create recipient user for", giftCardId);
    return;
  }

  // Atomic latch: only the first call flips purchased → sent and sets
  // recipient_user_id. Parallel callers see 0 rows and bail.
  const claimed = await queryOne<{ id: string }>(
    `UPDATE gift_cards
        SET status = 'sent',
            sent_at = NOW(),
            recipient_user_id = $1,
            stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $2)
      WHERE id = $3 AND status = 'purchased'
      RETURNING id`,
    [recipientUserId, paymentIntentId, giftCardId]
  );
  if (!claimed) {
    console.log(`[gift-card-fulfillment] another worker latched ${giftCardId}, skipping`);
    return;
  }

  // Fire email — locale follows the recipient's user.locale (which was
  // inherited from the buyer at creation, defaults to en).
  const locale = await queryOne<{ locale: string | null }>(
    "SELECT locale FROM users WHERE id = $1",
    [recipientUserId]
  );

  if (!isGiftCardTier(card.tier)) {
    console.error("[gift-card-fulfillment] invalid tier on card", card.id, card.tier);
    return;
  }

  try {
    await sendGiftCardEmail({
      recipientUserId,
      giftCardId: card.id,
      recipientName: card.recipient_name,
      recipientEmail: card.recipient_email,
      buyerName: card.buyer_name,
      tier: card.tier,
      personalMessage: card.personal_message,
      expiresAt: card.expires_at,
      locale: locale?.locale || "en",
      code: card.code,
    });
  } catch (emailErr) {
    console.error("[gift-card-fulfillment] email error:", emailErr);
    // Don't roll back — operator can manually re-trigger from /admin if needed.
  }

  // Buyer receipt — Photo Portugal-branded confirmation with gift
  // details. Stripe sends a card-charge receipt automatically; this one
  // adds the brand + a record of who received what + the code as a
  // fallback if the recipient says they never got the email.
  try {
    const buyerLocale = card.buyer_user_id
      ? await queryOne<{ locale: string | null }>("SELECT locale FROM users WHERE id = $1", [card.buyer_user_id])
      : null;
    await sendGiftCardBuyerReceipt({
      buyerName: card.buyer_name,
      buyerEmail: card.buyer_email,
      recipientName: card.recipient_name,
      recipientEmail: card.recipient_email,
      tier: card.tier,
      amount: Number(card.amount),
      code: card.code,
      expiresAt: card.expires_at,
      personalMessage: card.personal_message,
      locale: buyerLocale?.locale || "en",
    });
  } catch (buyerMailErr) {
    console.error("[gift-card-fulfillment] buyer receipt email error:", buyerMailErr);
  }

  // SMS nudge — only if recipient_phone is set. Best-effort.
  if (card.recipient_phone) {
    try {
      const sms = buildGiftCardSms(card.buyer_name, card.tier, locale?.locale || "en");
      sendSMS(card.recipient_phone, sms).catch((err) =>
        console.error("[gift-card-fulfillment] SMS error:", err)
      );
    } catch (smsErr) {
      console.error("[gift-card-fulfillment] SMS dispatch error:", smsErr);
    }
  }

  // Telegram admin notification — visibility on every gift card sold.
  try {
    const { sendTelegram } = await import("@/lib/telegram");
    sendTelegram(
      `🎁 <b>New gift card sold!</b>\n\n` +
        `<b>From:</b> ${escapeHtml(card.buyer_name)} (${escapeHtml(card.buyer_email)})\n` +
        `<b>To:</b> ${escapeHtml(card.recipient_name)} (${escapeHtml(card.recipient_email)})\n` +
        `<b>Tier:</b> ${card.tier === "express" ? "Express €349" : "Full €520"}\n` +
        `<b>Code:</b> <code>${card.code}</code>`,
      "stripe"
    ).catch(() => {});
  } catch {}
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
