import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
const VALID_SHOOT_TYPES = ["couples", "family", "proposal", "wedding", "honeymoon", "elopement", "solo", "engagement", "birthday", "friends"];

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

// Quick-match endpoint: minimal 2-field intake (email + location_slug). Optional shoot_type & source.
// Admin follows up by email to collect full details (date, budget, group size, etc).
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`quick-match:${ip}`, 3, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, location_slug, shoot_type, source } = body;

    if (!email?.trim() || !location_slug) {
      return NextResponse.json({ error: "Email and location required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const location = locations.find(l => l.slug === location_slug);
    if (!location) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
    const normalizedShootType = shoot_type && VALID_SHOOT_TYPES.includes(shoot_type) ? shoot_type : null;

    // Pull user_id if the visitor is signed in (so we can link follow-ups later)
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = (session?.user as { id?: string } | undefined)?.id || null;
    } catch {}

    // Best-effort name: use email local-part as placeholder until admin follows up
    const placeholderName = email.trim().split("@")[0] || "Guest";

    const result = await queryOne<{ id: string }>(
      `INSERT INTO match_requests (name, email, location_slug, shoot_type, user_id, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [placeholderName, email.trim(), location_slug, normalizedShootType, userId, source || null]
    );

    // Notify admin — short, actionable
    try {
      const adminEmail = await getAdminEmail();
      if (adminEmail) {
        const recipients = adminEmail.split(",").map(e => e.trim()).filter(Boolean);
        const locLabel = location.name;
        await Promise.all(recipients.map(to => sendEmail(
          to,
          `⚡ Quick Match request — ${locLabel}${normalizedShootType ? ` · ${normalizedShootType}` : ""}`,
          `<div style="font-family: sans-serif; max-width: 520px;">
            <h2 style="color: #C94536;">New Quick-Match lead</h2>
            <p>A visitor submitted the inline match form. Details are incomplete — please follow up to collect full brief.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <tr><td style="padding:6px 0;font-weight:bold;color:#666;width:120px;">Email:</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></td></tr>
              <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Location:</td><td style="padding:6px 0;">${escapeHtml(locLabel)}</td></tr>
              ${normalizedShootType ? `<tr><td style="padding:6px 0;font-weight:bold;color:#666;">Type:</td><td style="padding:6px 0;">${escapeHtml(normalizedShootType)}</td></tr>` : ""}
              ${source ? `<tr><td style="padding:6px 0;font-weight:bold;color:#666;">Source:</td><td style="padding:6px 0;">${escapeHtml(source)}</td></tr>` : ""}
            </table>
            <p style="margin-top:16px;"><a href="${BASE_URL}/admin#match-requests" style="display:inline-block;background:#C94536;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open in Admin →</a></p>
          </div>`
        ).catch(err => console.error("[quick-match] admin email error:", err))));
      }
    } catch (e) {
      console.error("[quick-match] admin notify error:", e);
    }

    // Confirmation to user
    try {
      const firstName = placeholderName.replace(/[^a-z0-9]/gi, "") || "there";
      await sendEmail(
        email.trim(),
        "We're finding your photographer — matches coming soon!",
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #C94536;">We're on it 🎯</h2>
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>Thanks for your request! Our team will reach out within a few hours to understand what you're looking for in <strong>${escapeHtml(location.name)}</strong>, and send you 2-3 hand-picked photographer recommendations.</p>
          <p>In the meantime, feel free to browse:</p>
          <p><a href="${BASE_URL}/photographers/location/${location_slug}" style="display:inline-block;background:#C94536;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Browse ${escapeHtml(location.name)} Photographers</a></p>
          <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
        </div>`
      );
    } catch (e) {
      console.error("[quick-match] user email error:", e);
    }

    // Telegram for admin
    try {
      import("@/lib/telegram").then(({ sendTelegram }) => {
        sendTelegram(
          `⚡ <b>Quick Match lead</b>\n<b>Location:</b> ${location.name}${normalizedShootType ? `\n<b>Type:</b> ${normalizedShootType}` : ""}\n<b>Email:</b> ${email.trim()}`,
          "match_requests"
        );
      }).catch(() => {});
    } catch {}

    return NextResponse.json({ success: true, id: result?.id });
  } catch (err) {
    console.error("[quick-match] error:", err);
    return NextResponse.json({ error: "Failed to create quick match" }, { status: 500 });
  }
}
