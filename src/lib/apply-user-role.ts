import { query, queryOne, withTransaction } from "@/lib/db";
import { defaultPhotographerSlug } from "@/lib/photographer-slug";
import { sendWelcomeEmail, sendAdminNewPhotographerNotification, sendAdminNewClientNotification } from "@/lib/email";
import { country } from "@/lib/country";

/**
 * Single source of truth for assigning/switching a user's role.
 * Extracted from /api/auth/set-role (2026-07-18) so the web GET, a web
 * POST (join-page conversion) and the mobile endpoint share identical
 * provisioning: photographer_profiles row + early-bird tier + welcome
 * email + admin Telegram.
 *
 * Allowed transitions:
 *  - no role yet (OAuth signup mid-flow)            → any
 *  - account created <5 min ago (fresh signup)      → any
 *  - client → photographer, when the account is EMPTY (zero bookings,
 *    no photographer profile). Born from the Lingyu case (2026-07-17):
 *    app OAuth silently made her a client, no way to switch, so one
 *    human ended up with 4 accounts and 2 photographer profiles.
 *  - anything else → { ok: false } (support/admin territory; flipping
 *    an active client or demoting a photographer has side effects we
 *    don't want self-serve).
 */
export async function applyUserRole(
  email: string,
  role: "photographer" | "client",
  displayName?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const user = await queryOne<{ id: string; name: string | null; role: string | null; admin_notified: boolean; created_at: string }>(
    "SELECT id, name, role, COALESCE(admin_notified, FALSE) as admin_notified, created_at FROM users WHERE email = $1",
    [email]
  );
  if (!user) return { ok: false, reason: "user_not_found" };
  if (user.role === role) return { ok: true };

  const createdAt = new Date(user.created_at);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const isFresh = !user.role || createdAt > fiveMinutesAgo;

  let allowed = isFresh;
  if (!allowed && user.role === "client" && role === "photographer") {
    // Empty-account conversion: nothing client-side depends on the role.
    const activity = await queryOne<{ bookings: string; profiles: string }>(
      `SELECT (SELECT COUNT(*) FROM bookings WHERE client_id = $1) AS bookings,
              (SELECT COUNT(*) FROM photographer_profiles WHERE user_id = $1) AS profiles`,
      [user.id]
    );
    allowed = parseInt(activity?.bookings || "0") === 0 && parseInt(activity?.profiles || "0") === 0;
    if (!allowed) return { ok: false, reason: "account_has_activity" };
  }
  if (!allowed) return { ok: false, reason: "not_allowed" };

  await query("UPDATE users SET role = $1 WHERE id = $2", [role, user.id]);
  const name = displayName || "there";

  if (role === "photographer") {
    // Readable from day one — see src/lib/photographer-slug.ts.
    const slug = await defaultPhotographerSlug(displayName || user.name, user.id);

    // Early-bird tier under an exclusive lock (concurrent signups race).
    await withTransaction(async (client) => {
      await client.query("LOCK TABLE photographer_profiles IN EXCLUSIVE MODE");
      const countResult = await client.query(
        "SELECT COUNT(*) as count, COALESCE(MAX(registration_number), 0) + 1 as next_num FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE"
      );
      const photographerCount = countResult.rows[0] as { count: string; next_num: string } | undefined;
      const count = parseInt(photographerCount?.count || "0");
      const nextNumber = parseInt(photographerCount?.next_num || "1");

      let earlyBirdTier: string | null = null;
      let earlyBirdExpires: string | null = null;
      let isFounding = false;
      let plan = "free";

      if (count < 10) {
        earlyBirdTier = "founding";
        isFounding = true;
        plan = "premium";
      } else if (count < 35) {
        earlyBirdTier = "early50";
        plan = "premium";
        earlyBirdExpires = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
      } else if (count < 100) {
        earlyBirdTier = "first100";
        plan = "premium";
        earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      }

      await client.query(
        `INSERT INTO photographer_profiles (user_id, slug, plan, is_founding, early_bird_tier, early_bird_expires_at, registration_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, slug, plan, isFounding, earlyBirdTier, earlyBirdExpires, nextNumber]
      );
    });

    // Fires only on a real role change — line 34 short-circuits when the role
    // is unchanged. Repeat client↔photographer toggling is bounded by the
    // per-user rate limit on the route rather than gated here, so the genuine
    // "signed up with Google, then chose photographer" path (whose
    // admin_notified is already set by the OAuth client creation) still gets
    // its welcome.
    sendWelcomeEmail(email, name, "photographer").catch((err) =>
      console.error("[apply-role] photographer welcome email:", err)
    );
    if (!user.admin_notified) {
      sendAdminNewPhotographerNotification(name, email).catch((err) =>
        console.error("[apply-role] admin notification:", err)
      );
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 <b>New Photographer!</b>\n\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}\n\n<a href="${country.baseUrl}/admin">Open Admin Panel →</a>`, "photographers");
      }).catch((err) => console.error("[apply-role] telegram:", err));
      query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [user.id]).catch(() => {});
    } else {
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`🔁 <b>Role changed: Client → Photographer</b>\n\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}\n\n<a href="${country.baseUrl}/admin">Open Admin Panel →</a>`, "photographers");
      }).catch((err) => console.error("[apply-role] telegram role-change:", err));
    }
  } else {
    if (!user.admin_notified) {
      import("@/lib/notification-queue").then(({ enqueueClientWelcome }) =>
        enqueueClientWelcome(user.id, email, name)
      ).catch((err) => console.error("[apply-role] client welcome queue:", err));
      sendAdminNewClientNotification(name, email).catch((err) =>
        console.error("[apply-role] admin client notification:", err)
      );
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(`👤 <b>New Client!</b>\n\n<b>Name:</b> ${name}\n<b>Email:</b> ${email}`, "clients");
      }).catch((err) => console.error("[apply-role] telegram new client:", err));
      query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [user.id]).catch(() => {});
    }
  }

  return { ok: true };
}
