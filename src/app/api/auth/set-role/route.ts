import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

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
      // Only allow role change for users created in the last 5 minutes (fresh signups)
      const user = await queryOne<{ id: string; role: string; created_at: string }>(
        "SELECT id, role, created_at FROM users WHERE email = $1",
        [session.user.email]
      );

      if (!user) {
        return NextResponse.redirect(`${base}${redirectPath}`);
      }

      const createdAt = new Date(user.created_at);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Only set role if user was just created (within 5 min)
      if (createdAt > fiveMinutesAgo) {
        await query("UPDATE users SET role = $1 WHERE id = $2", [role, user.id]);

        if (role === "photographer") {
          let slug = session.user.name
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || `photographer-${Date.now()}`;

          const existing = await queryOne(
            "SELECT id FROM photographer_profiles WHERE slug = $1 AND user_id != $2",
            [slug, user.id]
          );
          if (existing) {
            slug = `${slug}-${Date.now().toString(36)}`;
          }

          // Determine early bird tier (count only real photographers, not test accounts)
          const photographerCount = await queryOne<{ count: string }>(
            "SELECT COUNT(*) as count FROM photographer_profiles WHERE registration_number > 0"
          );
          const count = parseInt(photographerCount?.count || "0");
          const nextNumber = count + 1;

          let earlyBirdTier: string | null = null;
          let earlyBirdExpires: string | null = null;
          let isFounding = false;
          let plan = "free";

          if (count < 10) {
            // Founding 10: Premium forever
            earlyBirdTier = "founding";
            isFounding = true;
            plan = "premium";
          } else if (count < 60) {
            // Early 50: Premium for 6 months
            earlyBirdTier = "early50";
            plan = "premium";
            earlyBirdExpires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
          } else if (count < 160) {
            // First 100: Pro for 3 months
            earlyBirdTier = "first100";
            plan = "pro";
            earlyBirdExpires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
          }

          await query(
            `INSERT INTO photographer_profiles (user_id, slug, display_name, plan, is_founding, early_bird_tier, early_bird_expires_at, registration_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id, slug, session.user.name, plan, isFounding, earlyBirdTier, earlyBirdExpires, nextNumber]
          );
        }
      }
    }
  } catch (error) {
    console.error("[set-role] error:", error);
  }

  return NextResponse.redirect(`${base}${redirectPath}`);
}
