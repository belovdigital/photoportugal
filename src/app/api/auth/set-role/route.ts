import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { sendWelcomeEmail, sendAdminNewPhotographerNotification, sendAdminNewClientNotification } from "@/lib/email";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    const base = process.env.AUTH_URL || "https://photoportugal.com";
    return NextResponse.redirect(`${base}/auth/signin`);
  }

  const role = request.nextUrl.searchParams.get("role");
  let redirectPath = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

  // Validate redirect path to prevent open redirect attacks
  if (
    !redirectPath.startsWith("/") ||
    redirectPath.startsWith("//") ||
    redirectPath.includes("://") ||
    redirectPath.includes("\\")
  ) {
    redirectPath = "/dashboard";
  }

  try {
    if (role === "photographer" || role === "client") {
      // Only allow role change for users created in the last 2 minutes (fresh signups)
      const user = await queryOne<{ id: string; role: string; created_at: string }>(
        "SELECT id, role, created_at FROM users WHERE email = $1",
        [session.user.email]
      );

      if (!user) {
        return NextResponse.redirect(`${base}${redirectPath}`);
      }

      const createdAt = new Date(user.created_at);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      // Only set role if user was just created (within 2 min)
      if (createdAt > twoMinutesAgo) {
        await query("UPDATE users SET role = $1 WHERE id = $2", [role, user.id]);

        if (role === "photographer") {
          const shortId = user.id.replace(/-/g, "").slice(0, 10);
          let slug = `p-${shortId}`;

          // Uniqueness check — append random chars if collision
          const existingSlug = await queryOne("SELECT id FROM photographer_profiles WHERE slug = $1", [slug]);
          if (existingSlug) {
            const crypto = await import("crypto");
            slug = `${slug}${crypto.randomBytes(2).toString("hex").slice(0, 3)}`;
          }

          // Determine early bird tier (count only real photographers, not test accounts)
          // Wrapped in transaction with lock to prevent race conditions with concurrent signups
          await withTransaction(async (client) => {
            await client.query("LOCK TABLE photographer_profiles IN EXCLUSIVE MODE");
            const countResult = await client.query(
              "SELECT COUNT(*) as count, COALESCE(MAX(registration_number), 0) + 1 as next_num FROM photographer_profiles WHERE registration_number > 0"
            );
            const photographerCount = countResult.rows[0] as { count: string; next_num: string } | undefined;
            const count = parseInt(photographerCount?.count || "0");
            const nextNumber = parseInt(photographerCount?.next_num || "1");

            let earlyBirdTier: string | null = null;
            let earlyBirdExpires: string | null = null;
            let isFounding = false;
            let plan = "free";

            if (count < 10) {
              // Founding 10: Premium forever
              earlyBirdTier = "founding";
              isFounding = true;
              plan = "premium";
            } else if (count < 35) {
              // Early 50: Premium for 6 months
              earlyBirdTier = "early50";
              plan = "premium";
              earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
            } else if (count < 60) {
              // First 100: Pro for 3 months
              earlyBirdTier = "first100";
              plan = "pro";
              earlyBirdExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
            }

            await client.query(
              `INSERT INTO photographer_profiles (user_id, slug, plan, is_founding, early_bird_tier, early_bird_expires_at, registration_number)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (user_id) DO NOTHING`,
              [user.id, slug, plan, isFounding, earlyBirdTier, earlyBirdExpires, nextNumber]
            );
          });

          // Send photographer welcome email (non-blocking)
          sendWelcomeEmail(session.user.email!, session.user.name || "there", "photographer").catch((err) =>
            console.error("[set-role] Failed to send photographer welcome email:", err)
          );
          sendAdminNewPhotographerNotification(session.user.name || "Unknown", session.user.email!).catch((err) =>
            console.error("[set-role] Failed to send admin notification:", err)
          );
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`👤 <b>New Photographer!</b>\n\n${session.user!.name || "Unknown"}\n${session.user!.email}`);
          }).catch(() => {});
        } else {
          // Client: send welcome email + admin notification
          sendWelcomeEmail(session.user.email!, session.user.name || "there", "client").catch((err) =>
            console.error("[set-role] Failed to send client welcome email:", err)
          );
          sendAdminNewClientNotification(session.user.name || "Unknown", session.user.email!).catch((err) =>
            console.error("[set-role] Failed to send admin client notification:", err)
          );
          import("@/lib/telegram").then(({ sendTelegram }) => {
            sendTelegram(`👤 <b>New Client!</b>\n\n${session.user!.name || "Unknown"}\n${session.user!.email}`);
          }).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error("[set-role] error:", error);
  }

  return NextResponse.redirect(`${base}${redirectPath}`);
}
