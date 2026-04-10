import { queryOne } from "@/lib/db";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { sendAdminSMS } from "@/lib/sms";

/**
 * Check if a photographer just completed their onboarding checklist.
 * If so, notify admins (email + WhatsApp/SMS). Only fires once per photographer.
 */
export async function checkAndNotifyChecklistComplete(photographerId: string) {
  try {
    // Atomic check-and-set: only mark as notified if checklist is complete and not yet notified
    const updated = await queryOne<{ id: string }>(
      `UPDATE photographer_profiles pp SET checklist_notified = TRUE
       FROM users u
       WHERE pp.id = $1
         AND u.id = pp.user_id
         AND pp.checklist_notified = FALSE
         AND u.avatar_url IS NOT NULL
         AND pp.cover_url IS NOT NULL
         AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
         AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
         AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
         AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
         AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
         AND u.phone IS NOT NULL
       RETURNING pp.id`,
      [photographerId]
    );

    if (!updated) return; // already notified or checklist not complete

    const profile = await queryOne<{ name: string; email: string }>(`
      SELECT u.name, u.email
      FROM photographer_profiles pp
      JOIN users u ON u.id = pp.user_id
      WHERE pp.id = $1
    `, [photographerId]);

    if (!profile) return;

    // Notify admins
    const adminEmail = await getAdminEmail();
    sendEmail(
      adminEmail,
      `Photographer ready for approval: ${profile.name}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Photographer Ready for Approval</h2>
        <p><strong>${profile.name}</strong> (${profile.email}) has completed all onboarding steps and is ready to be reviewed.</p>
        <p><a href="https://photoportugal.com/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review in Admin</a></p>
      </div>`
    );

    sendAdminSMS(
      `Photo Portugal: ${profile.name} completed their profile and is ready for approval. Check admin panel.`
    );

    import("@/lib/telegram").then(({ sendTelegram }) => {
      sendTelegram(`📸 <b>Photographer Ready for Approval!</b>\n\n<b>Name:</b> ${profile!.name}\n<b>Email:</b> ${profile!.email}\n\nAll onboarding steps completed.\n\n<a href="https://photoportugal.com/admin">Review in Admin →</a>`);
    }).catch(e => console.error("[checklist-notify] telegram error:", e));
  } catch (err) {
    console.error("[checklist-notify] error:", err);
  }
}
