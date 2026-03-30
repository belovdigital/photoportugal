import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { sendEmail, getAdminEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const authUser = await authFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authUser as { id: string; name?: string; email: string; role: string };

  try {
    const { subject, message } = await req.json();

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    // Get admin notification email from platform_settings
    const adminEmail = await getAdminEmail();

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
      await sendEmail(email, `[Support] ${subject.trim()}`, html, { replyTo: user.email || undefined });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Support request error:", error);
    return NextResponse.json({ error: "Failed to send support request" }, { status: 500 });
  }
}
