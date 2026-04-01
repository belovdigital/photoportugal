import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendEmail, getAdminEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Save keyword position snapshot daily via GSC API
  try {
    const { google } = await import("googleapis");
    const fs = await import("fs");
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./google-credentials.json";
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const searchconsole = google.searchconsole({ version: "v1", auth });
    const now = new Date();
    const endDate = new Date(now.getTime() - 3 * 86400000).toISOString().split("T")[0];
    const startDate = new Date(now.getTime() - 33 * 86400000).toISOString().split("T")[0];
    const gscRes = await searchconsole.searchanalytics.query({
      siteUrl: "sc-domain:photoportugal.com",
      requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 500 },
    });
    const rows = gscRes.data.rows || [];
    const top3 = rows.filter(r => (r.position || 999) <= 3).length;
    const top10 = rows.filter(r => (r.position || 999) <= 10).length;
    const top20 = rows.filter(r => (r.position || 999) <= 20).length;
    const top100 = rows.filter(r => (r.position || 999) <= 100).length;
    await queryOne(
      `INSERT INTO keyword_snapshots (date, top3, top10, top20, top100, total)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)
       ON CONFLICT (date) DO UPDATE SET top3=$1, top10=$2, top20=$3, top100=$4, total=$5`,
      [top3, top10, top20, top100, rows.length]
    );
    console.log(`[cron/digest] keyword snapshot saved: top3=${top3} top10=${top10} top20=${top20} top100=${top100} total=${rows.length}`);
  } catch (err) {
    console.error("[cron/digest] keyword snapshot error:", err);
  }

  try {
    // Gather last 24h stats
    const [bookings, messages, users, payments, sessions] = await Promise.all([
      query<{ id: string; status: string; client_name: string; photographer_name: string; total_price: number | null; created_at: string; updated_at: string }>(
        `SELECT b.id, b.status, cu.name as client_name, pu.name as photographer_name,
                b.total_price, b.created_at::timestamp(0)::text, b.updated_at::timestamp(0)::text
         FROM bookings b
         JOIN users cu ON cu.id = b.client_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE b.created_at > NOW() - INTERVAL '24 hours'
         ORDER BY b.created_at DESC`
      ),
      queryOne<{ count: string }>(
        "SELECT COUNT(*)::text as count FROM messages WHERE created_at > NOW() - INTERVAL '24 hours' AND is_system = false"
      ),
      query<{ name: string; email: string; role: string; created_at: string }>(
        "SELECT name, email, role, created_at::timestamp(0)::text FROM users WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC"
      ),
      query<{ client_name: string; photographer_name: string; total_price: number; service_fee: number; platform_fee: number; status: string }>(
        `SELECT cu.name as client_name, pu.name as photographer_name, b.total_price, b.service_fee, b.platform_fee, b.payment_status as status
         FROM bookings b
         JOIN users cu ON cu.id = b.client_id
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users pu ON pu.id = pp.user_id
         WHERE b.payment_status = 'paid' AND b.updated_at > NOW() - INTERVAL '24 hours'`
      ),
      queryOne<{ count: string; visitors: string }>(
        `SELECT COUNT(*)::text as count, COUNT(DISTINCT visitor_id)::text as visitors
         FROM visitor_sessions WHERE started_at > NOW() - INTERVAL '24 hours'`
      ),
    ]);

    const messageCount = parseInt(messages?.count || "0");
    const sessionCount = parseInt(sessions?.count || "0");
    const visitorCount = parseInt(sessions?.visitors || "0");
    const grossRevenue = payments.reduce((sum, p) => sum + (p.total_price || 0) + (p.service_fee || 0), 0);
    const platformRevenue = payments.reduce((sum, p) => sum + (p.service_fee || 0) + (p.platform_fee || 0), 0);

    // Skip if absolutely nothing happened
    if (bookings.length === 0 && messageCount === 0 && users.length === 0 && sessionCount === 0) {
      return NextResponse.json({ skipped: true, reason: "no activity" });
    }

    // Build email
    const newBookingsHtml = bookings.length > 0
      ? bookings.map(b =>
        `<tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;">${b.client_name}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;">${b.photographer_name}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;"><span style="background: ${b.status === 'confirmed' ? '#dbeafe' : b.status === 'pending' ? '#fef9c3' : '#e5e7eb'}; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${b.status}</span></td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6; text-align: right;">${b.total_price ? `€${Math.round(b.total_price)}` : '—'}</td>
        </tr>`
      ).join("")
      : "";

    const newUsersHtml = users.length > 0
      ? users.map(u =>
        `<tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;">${u.name}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;">${u.email}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #f0e6d6;">${u.role}</td>
        </tr>`
      ).join("")
      : "";

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="color: #C94536; font-size: 22px; margin-bottom: 4px;">Daily Digest</h1>
      <p style="color: #999; font-size: 13px; margin-top: 0;">Last 24 hours — ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>

      <!-- Summary cards -->
      <div style="display: flex; gap: 8px; margin: 20px 0;">
        <div style="flex: 1; background: #faf8f5; border: 1px solid #e8ddd1; border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${bookings.length}</div>
          <div style="font-size: 12px; color: #666;">Bookings</div>
        </div>
        <div style="flex: 1; background: #faf8f5; border: 1px solid #e8ddd1; border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${messageCount}</div>
          <div style="font-size: 12px; color: #666;">Messages</div>
        </div>
        <div style="flex: 1; background: #faf8f5; border: 1px solid #e8ddd1; border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${users.length}</div>
          <div style="font-size: 12px; color: #666;">New Users</div>
        </div>
        <div style="flex: 1; background: #faf8f5; border: 1px solid #e8ddd1; border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${visitorCount}</div>
          <div style="font-size: 12px; color: #666;">Visitors</div>
        </div>
      </div>

      ${grossRevenue > 0 ? `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="margin-bottom: 8px;">
          <span style="font-size: 13px; color: #166534;">💰 Turnover:</span>
          <span style="font-size: 22px; font-weight: bold; color: #166534; margin-left: 8px;">€${Math.round(grossRevenue)}</span>
          <span style="font-size: 12px; color: #166534; margin-left: 4px;">(${payments.length} payment${payments.length !== 1 ? 's' : ''})</span>
        </div>
        <div>
          <span style="font-size: 13px; color: #166534;">📈 Platform revenue:</span>
          <span style="font-size: 22px; font-weight: bold; color: #166534; margin-left: 8px;">€${Math.round(platformRevenue)}</span>
        </div>
      </div>` : ""}

      ${bookings.length > 0 ? `
      <h3 style="font-size: 14px; color: #333; margin-bottom: 8px;">📅 Bookings</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead><tr style="background: #faf8f5;">
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Client</th>
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Photographer</th>
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Status</th>
          <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #666;">Price</th>
        </tr></thead>
        <tbody>${newBookingsHtml}</tbody>
      </table>` : ""}

      ${users.length > 0 ? `
      <h3 style="font-size: 14px; color: #333; margin-bottom: 8px;">👤 New Users</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead><tr style="background: #faf8f5;">
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Name</th>
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Email</th>
          <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #666;">Role</th>
        </tr></thead>
        <tbody>${newUsersHtml}</tbody>
      </table>` : ""}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${BASE_URL}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Admin Panel</a>
      </div>

      <p style="color: #ccc; font-size: 11px; text-align: center; margin-top: 24px;">Photo Portugal — Daily Digest</p>
    </div>`;

    const adminEmail = await getAdminEmail();
    const emails = adminEmail.split(",").map(e => e.trim()).filter(Boolean);
    for (const email of emails) {
      await sendEmail(
        email,
        `📊 Daily Digest — ${bookings.length} bookings, ${users.length} new users, ${messageCount} messages`,
        html
      );
    }

    // Telegram digest
    try {
      const { sendTelegram } = await import("@/lib/telegram");
      const lines = [`📊 <b>Daily Digest</b>\n`];
      lines.push(`📅 Bookings: ${bookings.length}`);
      lines.push(`💬 Messages: ${messageCount}`);
      lines.push(`👤 New users: ${users.length}`);
      lines.push(`👁 Visitors: ${visitorCount}`);
      if (grossRevenue > 0) {
        lines.push(`💰 Turnover: €${Math.round(grossRevenue)}`);
        lines.push(`📈 Platform revenue: €${Math.round(platformRevenue)}`);
      }
      await sendTelegram(lines.join("\n"));
    } catch {}

    // Daily Intercom sync
    try {
      const base = process.env.AUTH_URL || "https://photoportugal.com";
      await fetch(`${base}/api/admin/intercom-sync?secret=${process.env.CRON_SECRET}`, { method: "POST" });
    } catch {}

    return NextResponse.json({
      success: true,
      bookings: bookings.length,
      messages: messageCount,
      users: users.length,
      payments: payments.length,
      sessions: sessionCount,
    });
  } catch (error) {
    console.error("[cron/digest] error:", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
