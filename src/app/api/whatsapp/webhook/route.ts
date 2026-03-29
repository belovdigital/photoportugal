import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getAdminEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Twilio sends incoming WhatsApp messages here
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const from = formData.get("From")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const profileName = formData.get("ProfileName")?.toString() || "Unknown";

    // Strip "whatsapp:" prefix
    const phone = from.replace("whatsapp:", "");

    console.log(`[whatsapp-webhook] Incoming from ${profileName} (${phone}): ${body}`);

    // Forward to admin via email
    const adminEmail = await getAdminEmail();
    await sendEmail(
      adminEmail,
      `WhatsApp message from ${profileName} (${phone})`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">Incoming WhatsApp Message</h2>
        <p><strong>From:</strong> ${profileName}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left: 3px solid #C94536; padding: 8px 16px; margin: 12px 0; background: #fef2f2; border-radius: 4px;">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</blockquote>
        <p style="color: #666; font-size: 12px;">Reply to this customer directly through WhatsApp or the admin panel.</p>
      </div>`
    );

    // Return empty TwiML (no auto-reply for now)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("[whatsapp-webhook] error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
