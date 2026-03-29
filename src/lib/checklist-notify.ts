import { queryOne } from "@/lib/db";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { sendAdminWhatsApp } from "@/lib/whatsapp";

/**
 * Check if a photographer just completed their onboarding checklist.
 * If so, notify admins (email + WhatsApp/SMS). Only fires once per photographer.
 */
export async function checkAndNotifyChecklistComplete(photographerId: string) {
  try {
    const profile = await queryOne<{
      name: string;
      email: string;
      checklist_complete: boolean;
      checklist_notified: boolean;
    }>(`
      SELECT u.name, u.email,
        COALESCE(pp.checklist_notified, FALSE) as checklist_notified,
        (u.avatar_url IS NOT NULL
         AND pp.cover_url IS NOT NULL
         AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
         AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
         AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
         AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
         AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
         AND u.phone IS NOT NULL) as checklist_complete
      FROM photographer_profiles pp
      JOIN users u ON u.id = pp.user_id
      WHERE pp.id = $1 AND pp.is_approved = FALSE
    `, [photographerId]);

    if (!profile || !profile.checklist_complete || profile.checklist_notified) return;

    // Mark as notified so we don't spam
    await queryOne(
      "UPDATE photographer_profiles SET checklist_notified = TRUE WHERE id = $1",
      [photographerId]
    );

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

    sendAdminWhatsApp(
      "admin_new_booking",
      [profile.name, "completed checklist", "ready for approval"],
      `Photo Portugal: ${profile.name} completed their profile and is ready for approval. Check admin panel.`
    );
  } catch (err) {
    console.error("[checklist-notify] error:", err);
  }
}
