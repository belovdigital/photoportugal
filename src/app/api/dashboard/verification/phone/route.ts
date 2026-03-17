import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

// Send verification SMS
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { phone } = await req.json();

  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  try {
    const profile = await queryOne<{ id: string; is_verified: boolean }>(
      "SELECT id, is_verified FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (profile.is_verified) return NextResponse.json({ error: "Already verified" }, { status: 400 });

    // Ensure columns exist
    await queryOne("ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)", []);
    await queryOne("ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE", []);
    await queryOne("ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(6)", []);
    await queryOne("ALTER TABLE photographer_profiles ADD COLUMN IF NOT EXISTS phone_verification_sent_at TIMESTAMP", []);

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Save phone + code
    await queryOne(
      `UPDATE photographer_profiles
       SET phone_number = $1, phone_verification_code = $2, phone_verification_sent_at = NOW(), phone_verified = FALSE
       WHERE id = $3 RETURNING id`,
      [phone.trim(), code, profile.id]
    );

    // Send SMS via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone) {
      try {
        const twilio = (await import("twilio")).default;
        const client = twilio(accountSid, authToken);
        await client.messages.create({
          body: `Your Photo Portugal verification code is: ${code}`,
          from: fromPhone,
          to: phone.trim(),
        });
        console.log(`[verification] SMS sent to ${phone}`);
      } catch (smsErr) {
        console.error("[verification] SMS send error:", smsErr);
        return NextResponse.json({ error: "Failed to send SMS. Check phone number format." }, { status: 500 });
      }
    } else {
      // Dev mode: log code to console
      console.log(`[verification] DEV MODE — Code for ${phone}: ${code}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[verification/phone] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Verify code
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const { code } = await req.json();

  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  try {
    const profile = await queryOne<{
      id: string;
      phone_verification_code: string | null;
      phone_verification_sent_at: string | null;
    }>(
      "SELECT id, phone_verification_code, phone_verification_sent_at FROM photographer_profiles WHERE user_id = $1",
      [userId]
    );

    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (!profile.phone_verification_code) return NextResponse.json({ error: "No code sent" }, { status: 400 });

    // Check code expiry (10 minutes)
    if (profile.phone_verification_sent_at) {
      const sentAt = new Date(profile.phone_verification_sent_at);
      if (Date.now() - sentAt.getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
      }
    }

    // Check code
    if (profile.phone_verification_code !== code.trim()) {
      return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
    }

    // Mark phone as verified
    await queryOne(
      "UPDATE photographer_profiles SET phone_verified = TRUE, phone_verification_code = NULL WHERE id = $1 RETURNING id",
      [profile.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[verification/phone] verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
