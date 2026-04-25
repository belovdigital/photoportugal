import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { locations } from "@/lib/locations-data";
import { auth } from "@/lib/auth";

const VALID_BUDGETS = ["150-299", "300-599", "600+"];
const VALID_SHOOT_TYPES = ["couples", "family", "proposal", "wedding", "honeymoon", "elopement", "solo", "engagement", "birthday", "friends"];
const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`match-request:${ip}`, 3, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { name, email, phone, location_slug, shoot_date, shoot_time, date_flexible, flexible_date_from, flexible_date_to, shoot_type, group_size, budget_range, message, sms_consent, user_id: bodyUserId } = body;
    // Get user_id from session if not provided in body
    let user_id = bodyUserId;
    if (!user_id) {
      const session = await auth();
      user_id = (session?.user as { id?: string } | undefined)?.id || null;
    }

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !location_slug || !shoot_type || !budget_range) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    if (!locations.find(l => l.slug === location_slug)) {
      return NextResponse.json({ error: "Invalid location." }, { status: 400 });
    }

    if (!VALID_SHOOT_TYPES.includes(shoot_type)) {
      return NextResponse.json({ error: "Invalid shoot type." }, { status: 400 });
    }

    if (!VALID_BUDGETS.includes(budget_range)) {
      return NextResponse.json({ error: "Invalid budget range." }, { status: 400 });
    }

    // Insert into DB
    const result = await queryOne<{ id: string }>(
      `INSERT INTO match_requests (name, email, phone, location_slug, shoot_date, shoot_time, date_flexible, flexible_date_from, flexible_date_to, shoot_type, group_size, budget_range, message, sms_consent, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        name.trim(), email.trim(), phone?.trim() || null,
        location_slug, shoot_date || null, shoot_time || "flexible", date_flexible || false,
        flexible_date_from || null, flexible_date_to || null,
        shoot_type, group_size || 2, budget_range, message?.trim() || null,
        sms_consent !== false, user_id || null,
      ]
    );

    const locationName = locations.find(l => l.slug === location_slug)?.name || location_slug;
    const shootTypeLabel = shoot_type.charAt(0).toUpperCase() + shoot_type.slice(1);
    const budgetLabel = budget_range === "400+" ? "€400+" : `€${budget_range.replace("-", "–")}`;
    const dateDisplay = date_flexible
      ? `Flexible (${flexible_date_from || "?"} – ${flexible_date_to || "?"})`
      : shoot_date || "Flexible";

    // Confirmation email to client
    sendEmail(
      email.trim(),
      "We received your request — matches coming soon!",
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #C94536;">We're Finding Your Perfect Photographer</h2>
        <p>Hi ${escapeHtml(name.trim().split(" ")[0])},</p>
        <p>Thank you for your request! Our team is reviewing your preferences and will send you 2-3 hand-picked photographer recommendations within 2 hours.</p>
        <div style="margin:16px 0;padding:16px;background:#FAF8F5;border-radius:10px;border:1px solid #F3EDE6;">
          <p style="margin:0 0 8px;font-size:14px;color:#4A4A4A;"><strong>Location:</strong> ${escapeHtml(locationName)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4A4A4A;"><strong>Date:</strong> ${escapeHtml(dateDisplay)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4A4A4A;"><strong>Type:</strong> ${escapeHtml(shootTypeLabel)}</p>
          <p style="margin:0;font-size:14px;color:#4A4A4A;"><strong>Budget:</strong> ${escapeHtml(budgetLabel)}</p>
        </div>
        <p style="font-size:13px;color:#999;">In the meantime, feel free to browse our photographers:</p>
        <p><a href="${BASE_URL}/photographers/location/${location_slug}" style="display:inline-block;background:#C94536;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Browse Photographers</a></p>
        <p style="color:#999;font-size:12px;">Photo Portugal — photoportugal.com</p>
      </div>`
    ).catch(err => console.error("[match-request] client email error:", err));

    // Admin email
    const adminEmailStr = await getAdminEmail();
    const recipients = adminEmailStr.split(",").map((e: string) => e.trim()).filter(Boolean);
    const adminBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C94536;">New Match Request</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;width:120px;">Name:</td><td style="padding:6px 0;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Email:</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:6px 0;font-weight:bold;color:#666;">Phone:</td><td style="padding:6px 0;">${escapeHtml(phone)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Location:</td><td style="padding:6px 0;">${escapeHtml(locationName)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Date:</td><td style="padding:6px 0;">${escapeHtml(dateDisplay)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Type:</td><td style="padding:6px 0;">${escapeHtml(shootTypeLabel)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Group:</td><td style="padding:6px 0;">${group_size || 2} people</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#666;">Budget:</td><td style="padding:6px 0;">${escapeHtml(budgetLabel)}</td></tr>
          ${message ? `<tr><td style="padding:6px 0;font-weight:bold;color:#666;vertical-align:top;">Message:</td><td style="padding:6px 0;">${escapeHtml(message)}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;"><a href="${BASE_URL}/admin#matchRequests" style="display:inline-block;background:#C94536;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Admin → Match</a></p>
      </div>`;
    Promise.all(recipients.map(r => sendEmail(r, `[Match Request] ${name} — ${locationName} ${shootTypeLabel}`, adminBody)))
      .catch(err => console.error("[match-request] admin email error:", err));

    // Telegram
    import("@/lib/telegram").then(({ sendTelegram }) => {
      sendTelegram(`🔍 <b>New Match Request!</b>\n\n<b>Client:</b> ${name}\n<b>Location:</b> ${locationName}\n<b>Date:</b> ${dateDisplay}\n<b>Type:</b> ${shootTypeLabel}\n<b>Budget:</b> ${budgetLabel}\n${message ? `\n"${message.slice(0, 100)}"` : ""}\n\n<a href="${BASE_URL}/admin#matchRequests">Open Admin →</a>`, "match_requests");
    }).catch(err => console.error("[match-request] telegram error:", err));

    // SMS to admin
    import("@/lib/sms").then(({ sendAdminSMS }) => {
      sendAdminSMS(`Match Request: ${name} wants ${shootTypeLabel} in ${locationName} (${budgetLabel}). Check admin panel.`);
    }).catch(err => console.error("[match-request] sms error:", err));

    return NextResponse.json({ success: true, id: result?.id });
  } catch (error) {
    console.error("[match-request] error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
