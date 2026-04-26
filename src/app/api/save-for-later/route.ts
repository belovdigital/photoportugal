import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { sendSaveForLaterEmail } from "@/lib/email";
import { sendTelegram } from "@/lib/telegram";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { email, slug, locale } = await req.json();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

    const photographer = await queryOne<{
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      cover_url: string | null;
      min_price: number | null;
    }>(
      `SELECT pp.id, pp.slug, pu.name, pp.tagline, pp.cover_url,
              (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id) AS min_price
       FROM photographer_profiles pp
       JOIN users pu ON pu.id = pp.user_id
       WHERE pp.slug = $1 AND pp.is_approved = TRUE
       LIMIT 1`,
      [slug]
    );
    if (!photographer) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const cookieStore = await cookies();
    const visitor_id = cookieStore.get("pp_vid")?.value || null;
    const ua = req.headers.get("user-agent") || null;

    await query(
      `INSERT INTO saved_photographers (email, photographer_id, visitor_id, locale, user_agent, email_sent)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [email.trim().toLowerCase(), photographer.id, visitor_id, locale || "en", ua]
    );

    try {
      await sendSaveForLaterEmail(
        email.trim().toLowerCase(),
        {
          slug: photographer.slug,
          name: photographer.name,
          tagline: photographer.tagline,
          cover_url: photographer.cover_url,
          min_price: photographer.min_price ? Number(photographer.min_price) : null,
        },
        locale || "en"
      );
    } catch (err) {
      console.error("[save-for-later] email send failed:", err);
    }

    sendTelegram(
      `💌 <b>Saved for later</b>\n\nEmail: ${email.trim().toLowerCase()}\nPhotographer: <b>${photographer.name}</b>\nhttps://photoportugal.com/photographers/${photographer.slug}`,
      "clients"
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[save-for-later] error:", err);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/save-for-later", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
