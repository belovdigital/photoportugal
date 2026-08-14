import { queryOne, query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { country } from "@/lib/country";
import { STRIPE_GRACE_DAYS } from "@/lib/onboarding-stage";

/**
 * Everything that must happen exactly once when a photographer's `is_approved`
 * flips false → true, on whichever screen the admin happened to use.
 *
 * There are two approve buttons: the roster toggle (/api/admin/photographer)
 * and "approve the revision" (/api/admin/revisions), which also ends the
 * review. They had separate copies of this, and the copies had drifted: the
 * revision path never stamped `stripe_deadline_at`, so a photographer approved
 * from that screen skipped the entire grace week — no nudges, no hiding, and
 * no "Stripe подключён" close-out, because every one of those keys off the
 * deadline. It also mailed them "your profile is live" with no mention of the
 * payout account they still had to connect.
 *
 * Caller decides *whether* this is a first-time approval; this function
 * assumes it is and does not re-check, so guard on the previous value.
 */
export async function runApprovalSideEffects(profileId: string): Promise<void> {
  const row = await queryOne<{
    user_id: string;
    email: string;
    name: string;
    phone: string | null;
    locale: string | null;
    slug: string;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
  }>(
    `SELECT pp.user_id, u.email, u.name, u.phone, u.locale, pp.slug, pp.stripe_account_id,
            COALESCE(pp.stripe_onboarding_complete, FALSE) AS stripe_onboarding_complete
       FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
      WHERE pp.id = $1`,
    [profileId]
  );
  if (!row) return;

  const payoutConnected = Boolean(row.stripe_account_id && row.stripe_onboarding_complete);
  let deadline: string | null = null;

  if (!payoutConnected) {
    // Approval opens stage two. The deadline is stamped here and nowhere else
    // — the cron sweep keys off it, so a KYC lapse years later cannot drag
    // someone back into the new-joiner nudge sequence.
    const stamped = await query<{ stripe_deadline_at: Date }>(
      `UPDATE photographer_profiles
          SET stripe_deadline_at = NOW() + INTERVAL '${STRIPE_GRACE_DAYS} days',
              stripe_hidden_at = NULL,
              stripe_nudge_d1_sent = FALSE,
              stripe_nudge_d4_sent = FALSE,
              stripe_nudge_d6_sent = FALSE,
              stripe_overdue_admin_notified = FALSE
        WHERE id = $1
        RETURNING stripe_deadline_at`,
      [profileId]
    );
    const deadlineAt = stamped[0]?.stripe_deadline_at;
    deadline = deadlineAt ? new Date(deadlineAt).toISOString().slice(0, 10) : null;

    try {
      const { normalizeLocale } = await import("@/lib/email-locale");
      const { sendApprovedConnectStripeEmail } = await import("@/lib/email");
      await sendApprovedConnectStripeEmail(
        row.email, row.name, STRIPE_GRACE_DAYS, normalizeLocale(row.locale)
      );
    } catch (e) {
      console.error("[approval] connect-stripe email failed:", row.email, e);
    }
  } else {
    // Already payable — nothing is outstanding, so this is the only mail they
    // get. Anyone else gets the stage-two email above instead of two messages
    // that contradict each other about what is left to do.
    //
    // The celebration channels are gated the same way. Someone still owing a
    // payout account is live, technically, but "🎉 Your profile is live!" on
    // top of "connect Stripe within a week or it is hidden" is two messages
    // arguing about what they have to do next.
    await sendApprovedAndLiveEmail(row.email, row.name, row.slug);
    await notifyPhotographerLive(row.user_id, row.phone);
  }

  // Admins hear about every approval, not only the ones already payable. This
  // ping carries the phone number the WhatsApp group is built from.
  const stripeLine = payoutConnected
    ? "💳 Stripe подключён — платить можем."
    : `⏳ Stripe нет. Срок: ${deadline || `${STRIPE_GRACE_DAYS} дней`} — дальше профиль скроется сам.`;
  import("@/lib/telegram")
    .then(({ sendTelegram }) =>
      sendTelegram(
        `✅ <b>Photographer Approved!</b>\n\n<b>Name:</b> ${row.name}\n<b>Phone:</b> ${row.phone || "not set"}\n${stripeLine}\n\n👉 Add to WhatsApp group`,
        "photographers"
      )
    )
    .catch((err) => console.error("[approval] telegram failed:", err));

  // First-time approval → ping IndexNow so Bing/Yandex pick the profile up in
  // minutes instead of days. The URLs were hardcoded to photoportugal.com,
  // which submitted a Portuguese URL that does not exist for every Spanish and
  // Italian photographer approved since those markets opened.
  try {
    const { pingIndexNow } = await import("@/lib/indexnow");
    pingIndexNow([
      `${country.baseUrl}/photographers/${row.slug}`,
      `${country.baseUrl}/photographers`,
      `${country.baseUrl}/`,
    ]).catch(() => {});
  } catch { /* best-effort */ }
}

/** SMS + push + realtime for a freshly-live photographer. */
async function notifyPhotographerLive(userId: string, phone: string | null) {
  try {
    if (phone) {
      const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
        "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
        [userId]
      );
      if (smsPrefs?.sms_bookings !== false) {
        sendSMS(
          phone,
          `${country.brand}: Congratulations! Your profile is now live. Clients can find and book you at ${country.host}`
        ).catch((err) => console.error("[approval] sms error:", err));
      }
    }
    import("@/lib/push")
      .then((m) =>
        m.sendPushNotification(
          userId,
          "🎉 Your profile is live!",
          `Clients can now find and book you on ${country.brand}.`,
          { type: "profile_approved", channelId: "default", categoryId: "ACCOUNT" }
        )
      )
      .catch((err) => console.error("[approval] push error:", err));
    import("@/lib/realtime").then((m) => m.notifyUser(userId, "profile_approved"));
  } catch (err) {
    console.error("[approval] live notification error:", err);
  }
}

async function sendApprovedAndLiveEmail(to: string, name: string, slug: string) {
  const profileUrl = `${country.baseUrl}/photographers/${slug}`;
  return sendEmail(
    to,
    `Your profile is now live on ${country.brand}!`,
    `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #C94536;">Congratulations, ${name}!</h2>
      <p>Great news — your photographer profile has been reviewed and approved. You're now live on ${country.brand} and visible to thousands of tourists planning their trips to ${country.areaServed}.</p>

      <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
        <p style="margin: 0 0 8px; font-weight: bold; color: #166534;">Your profile is live:</p>
        <p style="margin: 0;"><a href="${profileUrl}" style="color: #C94536; font-weight: bold;">${profileUrl}</a></p>
      </div>

      <p style="font-weight: bold; color: #333;">Tips to get your first booking:</p>
      <ul style="line-height: 1.8; color: #555;">
        <li><strong>Keep your portfolio growing</strong> — the more range clients see, the more enquiries you get</li>
        <li><strong>Set competitive prices</strong> — Start with an attractive intro rate to build reviews</li>
        <li><strong>Add multiple locations</strong> — The more places you cover, the more clients find you</li>
        <li><strong>Write a compelling bio</strong> — Tell clients what makes your style unique</li>
      </ul>

      <p><a href="${country.baseUrl}/dashboard/profile" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Your Dashboard</a></p>

      <p style="color: #999; font-size: 12px;">${country.brand} — ${country.host}</p>
    </div>
    `
  ).catch((err) => console.error("[approval] live email error:", err));
}
