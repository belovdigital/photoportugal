import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getAdminEmail } from "@/lib/email";

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
    const { topic, name, email, message } = await req.json();

    if (!topic || !name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const topicLabel = TOPIC_LABELS[topic] || topic;

    // Get admin emails from DB settings — never trust client-provided recipients
    const adminEmailStr = await getAdminEmail();
    const recipients = adminEmailStr.split(",").map((e: string) => e.trim()).filter(Boolean);

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
          emailBody,
          { replyTo: email }
        )
      )
    ).catch((err) => console.error("[contact] email error:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] Error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
