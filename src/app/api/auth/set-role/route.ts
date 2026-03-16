import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  const role = request.nextUrl.searchParams.get("role");
  const redirect = request.nextUrl.searchParams.get("redirect") || "/dashboard";

  if (role === "photographer" || role === "client") {
    await query("UPDATE users SET role = $1 WHERE email = $2", [role, session.user.email]);

    // If photographer, create profile stub
    if (role === "photographer") {
      const userId = (session.user as { id?: string }).id;
      if (userId) {
        const slug = session.user.name
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `photographer-${Date.now()}`;

        await query(
          `INSERT INTO photographer_profiles (user_id, slug, display_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, slug, session.user.name]
        );
      }
    }
  }

  return NextResponse.redirect(new URL(redirect, request.url));
}
