import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TOPIC_LABELS: Record<string, string> = {
  clientSupport: "Client Support",
  photographerSupport: "Photographer Support",
  sales: "Sales Inquiry",
  pr: "Press & Media",
  other: "General Inquiry",
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(`contact:${ip}`, 5, 3600000)) {
      return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
    }

    const { topic, name, email, message } = await req.json();

    if (!topic || !name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const topicLabel = TOPIC_LABELS[topic] || topic;

    // Always send to CTO + CEO, plus any admin emails from DB
    const CONTACT_RECIPIENTS = ["cto@photoportugal.com", "ceo@photoportugal.com"];
    const adminEmailStr = await getAdminEmail();
    const adminEmails = adminEmailStr.split(",").map((e: string) => e.trim()).filter(Boolean);
    const recipients = [...new Set([...CONTACT_RECIPIENTS, ...adminEmails])];

    const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C94536;">New Contact Form Message</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #666; width: 100px;">Topic:</td><td style="padding: 8px 0;">${topicLabel}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Name:</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #666;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #faf8f5; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
          <p style="margin-top: 20px; color: #999; font-size: 12px;">Reply directly to this email to respond to ${escapeHtml(name)} at ${escapeHtml(email)}</p>
        </div>
        `;

    // Fire emails in background — don't block the response
    Promise.all(
      recipients.map((recipient: string) =>
        sendEmail(
          recipient,
          `[Photo Portugal] ${topicLabel}: ${name}`,
          emailBody
        )
      )
    ).catch((err) => console.error("[contact] email error:", err));

    // Telegram: notify admin of contact form submission
    import("@/lib/telegram").then(({ sendTelegram }) => {
      sendTelegram(`📩 <b>Contact Form</b>\n\n${topicLabel}\nFrom: ${name} (${email})\n\n${message.slice(0, 200)}`, "clients");
    }).catch((err) => console.error("[contact] telegram error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] Error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/contact", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
