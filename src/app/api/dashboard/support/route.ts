import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id?: string; name?: string; email?: string; role?: string };

  try {
    const { subject, message } = await req.json();

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    // Get admin notification email: first check platform_settings, fallback to default
    let adminEmail = "info@photoportugal.com";
    try {
      const setting = await queryOne<{ value: string }>(
        "SELECT value FROM platform_settings WHERE key = 'admin_notification_email'"
      );
      if (setting?.value) {
        adminEmail = setting.value;
      }
    } catch {
      // Table might not exist yet, use fallback
    }

    const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #C94536;">Support Request</h2>
      <p><strong>From:</strong> ${user.name || "Unknown"} (${user.email || "no email"})</p>
      <p><strong>Role:</strong> ${user.role || "unknown"}</p>
      <p><strong>Subject:</strong> ${subject.trim()}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
      <p style="white-space: pre-wrap;">${message.trim()}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
      <p style="color: #999; font-size: 12px;">You can reply directly to this user at: ${user.email || "N/A"}</p>
      <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
    </div>
    `;

    // Support multiple emails separated by commas
    const emails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
    for (const email of emails) {
      await sendEmail(email, `[Support] ${subject.trim()}`, html);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Support request error:", error);
    return NextResponse.json({ error: "Failed to send support request" }, { status: 500 });
  }
}
