import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";
    return NextResponse.redirect(`${base}/auth/signin`);
  }

  const role = request.nextUrl.searchParams.get("role");
  const redirectPath = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

  try {
    if (role === "photographer" || role === "client") {
      await query("UPDATE users SET role = $1 WHERE email = $2", [role, session.user.email]);

      if (role === "photographer") {
        const userId = (session.user as { id?: string }).id;
        if (userId) {
          let slug = session.user.name
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || `photographer-${Date.now()}`;

          // Check for slug collision and add suffix if needed
          const existing = await queryOne(
            "SELECT id FROM photographer_profiles WHERE slug = $1 AND user_id != $2",
            [slug, userId]
          );
          if (existing) {
            slug = `${slug}-${Date.now().toString(36)}`;
          }

          await query(
            `INSERT INTO photographer_profiles (user_id, slug, display_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, slug, session.user.name]
          );
        }
      }
    }
  } catch (error) {
    console.error("[set-role] error:", error);
  }

  return NextResponse.redirect(`${base}${redirectPath}`);
}
