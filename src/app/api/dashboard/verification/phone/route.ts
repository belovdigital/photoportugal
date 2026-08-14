import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { authFromRequest } from "@/lib/mobile-auth";
import { queryOne } from "@/lib/db";
import twilio from "twilio";
import { checkRateLimit } from "@/lib/rate-limit";
import { country } from "@/lib/country";

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

  // Normalize to E.164. Strip spaces/dashes/parens/dots, then (for Portugal,
  // where `dialCode` is "+351"):
  //   "+49179…"   -> kept (already international)
  //   "0049179…"  -> "+49179…"    (00 = international access code)
  //   "351912…"   -> "+351912…"   (home country code typed without the +)
  //   "912345678" -> "+351912345678" (bare local number)
  // Previously we blindly prepended +351 to ANYTHING without a leading "+",
  // which turned a German "00491797489111" into "+35100491797489111" and
  // Twilio rejected it ("Invalid parameter `To`").
  //
  // The home code comes from the country pack rather than a literal: on the
  // Spanish site a bare "612345678" was being turned into "+351612345678",
  // sending every Spanish photographer's verification code to a Portuguese
  // number, so verification could not be completed at all.
  const homeCode = country.dialCode.replace("+", "");
  let formattedPhone = phone.trim().replace(/[\s\-().]/g, "");
  if (formattedPhone.startsWith("00")) {
    formattedPhone = "+" + formattedPhone.slice(2);
  } else if (!formattedPhone.startsWith("+")) {
    formattedPhone = formattedPhone.startsWith(homeCode)
      ? "+" + formattedPhone
      : country.dialCode + formattedPhone;
  }

  // Reject obviously-invalid E.164 (8-15 digits) up front, so we return a
  // clean 400 instead of a Twilio 500 that spams the error log.
  const digitCount = formattedPhone.replace(/\D/g, "").length;
  if (digitCount < 8 || digitCount > 15) {
    return NextResponse.json(
      { error: `Invalid phone number. Include your country code, e.g. +49… or ${country.dialCode}…` },
      { status: 400 }
    );
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
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/verification/phone", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: msg.includes("Invalid") ? `Invalid phone number format. Use ${country.dialCode}...` : "Failed to send code" }, { status: 500 });
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
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
    }
  } catch (error) {
    console.error("[verification/phone] verify error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/dashboard/verification/phone", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Verification failed. Code may be expired." }, { status: 500 });
  }
}
