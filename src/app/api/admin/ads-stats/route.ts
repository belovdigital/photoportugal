import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  const data = verifyToken(token);
  if (!data) return null;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin" ? data : null;
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Total ad visits (last 30 days to match displayed period)
    const visitCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM ad_visits WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= NOW() - INTERVAL '30 days'"
    );

    // Visits today
    const visitsTodayRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM ad_visits WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= CURRENT_DATE"
    );

    // Visits last 7 days
    const visits7dRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM ad_visits WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
    );

    // Signups from ads (users with utm_source = google)
    const signupsRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE utm_source = 'google'"
    );

    // Bookings from ads
    const adsBookings = await query<{
      id: string;
      total_price: number | null;
      payment_status: string | null;
      status: string;
      created_at: string;
      utm_campaign: string | null;
      utm_term: string | null;
    }>(
      `SELECT id, total_price, payment_status, status, created_at, utm_campaign, utm_term
       FROM bookings
       WHERE utm_source = 'google' AND utm_medium = 'cpc'
       ORDER BY created_at DESC`
    );

    const totalBookings = adsBookings.length;
    const paidBookings = adsBookings.filter(b => b.payment_status === "paid");
    const revenue = paidBookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);

    // Top landing pages
    const topLandingPages = await query<{ landing_page: string; count: string }>(
      `SELECT landing_page, COUNT(*) as count FROM ad_visits
       WHERE utm_source = 'google' AND utm_medium = 'cpc' AND landing_page IS NOT NULL
       GROUP BY landing_page ORDER BY count DESC LIMIT 10`
    );

    // Top keywords by visits
    const topKeywordVisits = await query<{ utm_term: string; count: string }>(
      `SELECT COALESCE(utm_term, '(not set)') as utm_term, COUNT(*) as count FROM ad_visits
       WHERE utm_source = 'google' AND utm_medium = 'cpc'
       GROUP BY utm_term ORDER BY count DESC LIMIT 10`
    );

    // Merge keyword data with booking data
    const bookingKeywordMap = new Map<string, { bookings: number; revenue: number }>();
    for (const b of adsBookings) {
      const kw = b.utm_term || "(not set)";
      const entry = bookingKeywordMap.get(kw) || { bookings: 0, revenue: 0 };
      entry.bookings++;
      if (b.payment_status === "paid") entry.revenue += Number(b.total_price || 0);
      bookingKeywordMap.set(kw, entry);
    }

    const topKeywords = topKeywordVisits.map(kv => ({
      keyword: kv.utm_term,
      visits: parseInt(kv.count),
      bookings: bookingKeywordMap.get(kv.utm_term)?.bookings || 0,
      revenue: bookingKeywordMap.get(kv.utm_term)?.revenue || 0,
    }));

    // Daily visits (last 14 days)
    const dailyVisits = await query<{ date: string; count: string }>(
      `SELECT DATE(created_at) as date, COUNT(*) as count FROM ad_visits
       WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY DATE(created_at) ORDER BY date`
    );

    // Recent ad visitors with their page journey
    const recentVisitors = await query<{
      id: string;
      utm_term: string | null;
      utm_campaign: string | null;
      landing_page: string | null;
      created_at: string;
    }>(
      `SELECT id, utm_term, utm_campaign, landing_page, created_at FROM ad_visits
       WHERE utm_source = 'google' AND utm_medium = 'cpc'
       ORDER BY created_at DESC LIMIT 20`
    );

    // Get pageviews for recent ad visitors (matched by time window)
    const recentWithJourney = [];
    for (const v of recentVisitors) {
      const visitTime = new Date(v.created_at);
      const windowEnd = new Date(visitTime.getTime() + 30 * 60 * 1000); // 30 min window
      const pages = await query<{ path: string }>(
        `SELECT path FROM ad_pageviews
         WHERE utm_source = 'google' AND created_at >= $1 AND created_at <= $2
         ORDER BY created_at`,
        [visitTime.toISOString(), windowEnd.toISOString()]
      );
      recentWithJourney.push({
        keyword: v.utm_term || "(not set)",
        campaign: v.utm_campaign || "",
        landing: v.landing_page || "/",
        time: v.created_at,
        pages: pages.map(p => p.path),
        converted: false, // will be updated below
      });
    }

    // Check if any visitor converted (booking within 24h of visit)
    for (const v of recentWithJourney) {
      const visitTime = new Date(v.time);
      const dayAfter = new Date(visitTime.getTime() + 24 * 60 * 60 * 1000);
      const booking = await queryOne<{ id: string }>(
        `SELECT id FROM bookings
         WHERE utm_source = 'google' AND utm_medium = 'cpc'
         AND created_at >= $1 AND created_at <= $2
         LIMIT 1`,
        [visitTime.toISOString(), dayAfter.toISOString()]
      );
      if (booking) v.converted = true;
    }

    // Most viewed pages by ad visitors
    const topAdPages = await query<{ path: string; count: string }>(
      `SELECT path, COUNT(*) as count FROM ad_pageviews
       WHERE utm_source = 'google'
       GROUP BY path ORDER BY count DESC LIMIT 10`
    );

    const visits = parseInt(visitCount?.count || "0");
    const signups = parseInt(signupsRow?.count || "0");

    return NextResponse.json({
      visits,
      visitsToday: parseInt(visitsTodayRow?.count || "0"),
      visits7d: parseInt(visits7dRow?.count || "0"),
      signups,
      bookingsFromAds: totalBookings,
      paidBookings: paidBookings.length,
      revenueFromAds: revenue,
      visitToBookingRate: visits > 0 ? ((totalBookings / visits) * 100).toFixed(1) : "0",
      bookingToPayRate: totalBookings > 0 ? ((paidBookings.length / totalBookings) * 100).toFixed(1) : "0",
      topKeywords,
      topLandingPages: topLandingPages.map(p => ({ page: p.landing_page, visits: parseInt(p.count) })),
      dailyVisits: dailyVisits.map(d => ({ date: d.date, visits: parseInt(d.count) })),
      recentVisitors: recentWithJourney,
      topAdPages: topAdPages.map(p => ({ page: p.path, views: parseInt(p.count) })),
    });
  } catch (error) {
    console.error("[admin/ads-stats] error:", error);
    return NextResponse.json(null);
  }
}
