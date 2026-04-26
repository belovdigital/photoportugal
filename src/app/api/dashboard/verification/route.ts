import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Request verification
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  try {
    const profile = await queryOne<{ id: string; is_verified: boolean; verification_requested_at: string | null }>(
      "SELECT id, is_verified, verification_requested_at FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );

    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (profile.is_verified) return NextResponse.json({ error: "Already verified" }, { status: 400 });
    if (profile.verification_requested_at) return NextResponse.json({ error: "Already requested" }, { status: 400 });

    await queryOne(
      "UPDATE photographer_profiles SET verification_requested_at = NOW() WHERE id = $1 RETURNING id",
      [profile.id]
    );

    // Notify admin
    const user = await queryOne<{ name: string; email: string }>(
      "SELECT name, email FROM users WHERE id = $1", [userId]
    );
    if (user) {
      const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
      await sendEmail(
        "info@photoportugal.com",
        `Verification request from ${user.name}`,
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #C94536;">New Verification Request</h2>
          <p><strong>${user.name}</strong> (${user.email}) has requested profile verification.</p>
          <p><a href="${BASE_URL}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review in Admin Panel</a></p>
        </div>`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[verification] error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/verification", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
