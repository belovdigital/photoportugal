import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  try {
    const user = await queryOne<{ phone: string | null }>("SELECT phone FROM users WHERE id = $1", [userId]);
    return NextResponse.json({ phone: user?.phone || null });
  } catch {
    return NextResponse.json({ phone: null });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
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
    // Soft-delete: anonymize user data instead of hard-deleting
    // This preserves bookings, reviews, and messages for data integrity
    const deletedEmail = `deleted_${userId}@deleted.photoportugal.com`;

    await queryOne(
      `UPDATE users SET
        name = 'Deleted User',
        first_name = 'Deleted',
        last_name = 'User',
        email = $1,
        password_hash = NULL,
        avatar_url = NULL,
        google_id = NULL,
        phone = NULL,
        is_banned = TRUE
      WHERE id = $2 RETURNING id`,
      [deletedEmail, userId]
    );

    // If photographer: anonymize profile but keep the row
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );
    if (profile) {
      await queryOne(
        `UPDATE photographer_profiles SET
          display_name = 'Deleted Photographer',
          is_approved = FALSE,
          tagline = NULL,
          bio = NULL,
          cover_url = NULL,
          phone_number = NULL,
          stripe_account_id = NULL,
          stripe_onboarding_complete = FALSE
        WHERE id = $1 RETURNING id`,
        [profile.id]
      );
    }

    // Clear notification preferences
    await query("DELETE FROM notification_preferences WHERE user_id = $1", [userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
