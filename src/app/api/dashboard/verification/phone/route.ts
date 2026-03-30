import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import { checkAndNotifyChecklistComplete } from "@/lib/checklist-notify";
import twilio from "twilio";
import { checkRateLimit } from "@/lib/rate-limit";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;

// Send verification SMS via Twilio Verify
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`phone-verify:${ip}`, 3, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { phone } = await req.json();

  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // Auto-prefix with +351 for Portuguese numbers without country code
  let formattedPhone = phone.trim().replace(/\s+/g, "");
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = "+351" + formattedPhone;
  }

  try {
    const profile = await queryOne<{ id: string; is_verified: boolean }>(
      "SELECT id, is_verified FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 400 });
    if (profile.is_verified) return NextResponse.json({ error: "Already verified" }, { status: 400 });

    // Save phone number
    await queryOne(
      "UPDATE photographer_profiles SET phone_number = $1, phone_verified = FALSE WHERE id = $2 RETURNING id",
      [formattedPhone, profile.id]
    );

    // Send via Twilio Verify
    if (accountSid && authToken && verifySid) {
      const client = twilio(accountSid, authToken);
      await client.verify.v2.services(verifySid)
        .verifications.create({ to: formattedPhone, channel: "sms" });
      console.log(`[verification] Twilio Verify SMS sent to ${formattedPhone}`);
    } else {
      console.log(`[verification] Twilio not configured — skipping SMS to ${phone}`);
      return NextResponse.json({ error: "SMS service not configured" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[verification/phone] error:", error);
    const msg = error instanceof Error ? error.message : "Failed to send SMS";
    return NextResponse.json({ error: msg.includes("Invalid") ? "Invalid phone number format. Use +351..." : "Failed to send code" }, { status: 500 });
  }
}

// Verify code via Twilio Verify
export async function PUT(req: NextRequest) {
  const authUser = await authFromRequest(req);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = authUser.id;
  const { code } = await req.json();

  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  try {
    const profile = await queryOne<{ id: string; phone_number: string | null }>(
      "SELECT id, phone_number FROM photographer_profiles WHERE user_id = $1", [userId]
    );
    if (!profile || !profile.phone_number) {
      return NextResponse.json({ error: "No phone number on record" }, { status: 400 });
    }

    if (!accountSid || !authToken || !verifySid) {
      return NextResponse.json({ error: "SMS service not configured" }, { status: 500 });
    }

    // Check code with Twilio Verify
    const client = twilio(accountSid, authToken);
    const check = await client.verify.v2.services(verifySid)
      .verificationChecks.create({ to: profile.phone_number, code: code.trim() });

    if (check.status === "approved") {
      await queryOne(
        "UPDATE photographer_profiles SET phone_verified = TRUE WHERE id = $1 RETURNING id",
        [profile.id]
      );
      checkAndNotifyChecklistComplete(profile.id).catch(() => {});
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
    }
  } catch (error) {
    console.error("[verification/phone] verify error:", error);
    return NextResponse.json({ error: "Verification failed. Code may be expired." }, { status: 500 });
  }
}
