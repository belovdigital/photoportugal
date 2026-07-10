import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendEmail, getAdminEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_EVENT_TYPES = ["corporate_event", "conference", "team_headshots", "brand_content", "real_estate", "other"];
const VALID_SOURCES = ["business_page", "profile", "photoshoots", "homepage", "concierge"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Public B2B inquiry intake. The pipeline is deliberately human: admins get
// email + Telegram and work the deal personally (quote, pick photographers,
// invoice) — the platform is the single counterparty for the business.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(`business-inquiry:${ip}`, 3, 600_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    company_name, contact_name, email, phone,
    event_type, event_date, location, headcount, message,
    source, photographer_slug,
  } = body;

  if (!company_name?.trim() || !contact_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Company, contact name and email are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const eventType = VALID_EVENT_TYPES.includes(event_type) ? event_type : "other";
  const src = VALID_SOURCES.includes(source) ? source : "business_page";
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(event_date || "") ? event_date : null;

  // Optional photographer link when filed from a profile card
  let photographerId: string | null = null;
  let photographerName: string | null = null;
  if (typeof photographer_slug === "string" && /^[a-z0-9-]+$/.test(photographer_slug)) {
    const p = await queryOne<{ id: string; display_name: string }>(
      "SELECT id, display_name FROM photographer_profiles WHERE slug = $1",
      [photographer_slug]
    );
    if (p) {
      photographerId = p.id;
      photographerName = p.display_name;
    }
  }

  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO business_inquiries
       (company_name, contact_name, email, phone, event_type, event_date, location, headcount, message, source, photographer_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      company_name.trim().slice(0, 200),
      contact_name.trim().slice(0, 200),
      email.trim().toLowerCase().slice(0, 255),
      phone?.trim().slice(0, 50) || null,
      eventType,
      eventDate,
      location?.trim().slice(0, 200) || null,
      headcount?.trim().slice(0, 50) || null,
      message?.trim().slice(0, 5000) || null,
      src,
      photographerId,
    ]
  );

  const lines = [
    `<p><strong>Company:</strong> ${escapeHtml(company_name.trim())}</p>`,
    `<p><strong>Contact:</strong> ${escapeHtml(contact_name.trim())} — ${escapeHtml(email.trim())}${phone ? ` — ${escapeHtml(phone.trim())}` : ""}</p>`,
    `<p><strong>Type:</strong> ${eventType}${eventDate ? ` · <strong>Date:</strong> ${eventDate}` : ""}${location ? ` · <strong>Where:</strong> ${escapeHtml(location.trim())}` : ""}${headcount ? ` · <strong>People:</strong> ${escapeHtml(headcount.trim())}` : ""}</p>`,
    photographerName ? `<p><strong>Asked about photographer:</strong> ${escapeHtml(photographerName)}</p>` : "",
    message?.trim() ? `<p><strong>Message:</strong><br/>${escapeHtml(message.trim()).replace(/\n/g, "<br/>")}</p>` : "",
    `<p style="color:#888">Source: ${src} · Inquiry ${inserted?.id}</p>`,
  ].filter(Boolean).join("\n");

  // Fire-and-forget notifications — the visitor's 200 must not wait on SMTP
  getAdminEmail()
    .then((admins) =>
      Promise.all(
        admins.split(",").map((r) =>
          sendEmail(r.trim(), `💼 [Business] ${company_name.trim()} — ${eventType}`, lines, { replyTo: email.trim() })
        )
      )
    )
    .catch((e) => console.error("[business-inquiry] admin email failed:", e));

  import("@/lib/telegram")
    .then(({ sendTelegram }) =>
      sendTelegram(
        `💼 <b>Business inquiry</b>\n${escapeHtml(company_name.trim())} — ${eventType}\n` +
          `${escapeHtml(contact_name.trim())} · ${escapeHtml(email.trim())}${phone ? ` · ${escapeHtml(phone.trim())}` : ""}\n` +
          `${eventDate ? `📅 ${eventDate} · ` : ""}${location ? `📍 ${escapeHtml(location.trim())} · ` : ""}${headcount ? `👥 ${escapeHtml(headcount.trim())}` : ""}\n` +
          `${photographerName ? `📷 Re: ${escapeHtml(photographerName)}\n` : ""}Source: ${src}`,
        "match_requests"
      )
    )
    .catch(() => {});

  return NextResponse.json({ ok: true, id: inserted?.id });
}
