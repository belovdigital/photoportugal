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
  const redirectPath = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

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

      // Only set role if user was just created (within 5 min) or still has default 'client' role
      if (createdAt > fiveMinutesAgo || user.role === "client") {
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

          await query(
            `INSERT INTO photographer_profiles (user_id, slug, display_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id, slug, session.user.name]
          );
        }
      }
    }
  } catch (error) {
    console.error("[set-role] error:", error);
  }

  return NextResponse.redirect(`${base}${redirectPath}`);
}
