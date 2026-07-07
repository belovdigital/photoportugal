import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";

export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await queryOne<{
      name: string; first_name: string | null; last_name: string | null;
      email: string; phone: string | null; avatar_url: string | null;
    }>(
      "SELECT name, first_name, last_name, email, phone, avatar_url FROM users WHERE id = $1",
      [user.id]
    );
    return NextResponse.json(data || {});
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(req: NextRequest) {
  const mobileUser = await authFromRequest(req);
  const session = !mobileUser ? await auth() : null;
  const userId = mobileUser?.id || (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { first_name, last_name, name: legacyName, phone: rawPhone } = await req.json();
  const firstName = (first_name || legacyName?.split(" ")[0] || "").trim();
  const lastName = (last_name ?? legacyName?.split(" ").slice(1).join(" ") ?? "").trim();
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  if (!firstName) return NextResponse.json({ error: "First name required" }, { status: 400 });

  // Validate and normalize phone number (E.164 format)
  let phone: string | null = null;
  if (rawPhone) {
    const cleaned = rawPhone.replace(/[\s\-]/g, "");
    if (!cleaned.startsWith("+")) {
      return NextResponse.json({ error: "Phone number must start with + (country code)" }, { status: 400 });
    }
    const digits = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digits)) {
      return NextResponse.json({ error: "Phone number must be 7-15 digits after the country code" }, { status: 400 });
    }
    phone = cleaned;
  }

  try {
    await queryOne("UPDATE users SET name = $1, first_name = $2, last_name = $3, phone = $4 WHERE id = $5 RETURNING id", [fullName, firstName, lastName, phone || null, userId]);
    const profile = await queryOne<{ id: string }>("SELECT id FROM photographer_profiles WHERE user_id = $1", [userId]);
    if (profile) checkAndNotifyChecklistComplete(profile.id).catch(() => {});
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const mobileUser = await authFromRequest(req);
  const session = !mobileUser ? await auth() : null;
  const userId = mobileUser?.id || (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { confirmation } = await req.json();
    if (confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Reversible deactivation — NOT a destructive wipe. We block login
    // (is_banned) and hide the profile from the catalog/search
    // (is_approved = FALSE), and stamp deactivated_at so we can tell a
    // self-deactivation apart from an admin ban. ALL data is preserved
    // (name, email, profile content, Stripe), so the account can be
    // fully restored if the photographer comes back or deleted by
    // mistake — just clear is_banned + deactivated_at and re-approve.
    //
    // We deliberately do NOT anonymize: the old behaviour overwrote the
    // email with deleted_<id>@deleted.photoportugal.com (a dead domain),
    // which (a) made restore impossible and (b) bounced every system
    // email still aimed at the account. A true GDPR erasure, if ever
    // requested, is a separate deliberate admin action.
    await queryOne(
      `UPDATE users SET is_banned = TRUE, deactivated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [userId]
    );

    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );
    if (profile) {
      await queryOne(
        `UPDATE photographer_profiles SET is_approved = FALSE WHERE id = $1 RETURNING id`,
        [profile.id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/dashboard/account", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
