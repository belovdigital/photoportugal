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

async function getGoogleAdsData() {
  try {
    const { GoogleAdsApi } = require("google-ads-api");
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    const customer = client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });

    // Campaign totals (last 30 days)
    const campaignRows = await customer.query(`
      SELECT
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions, metrics.ctr, metrics.average_cpc
      FROM campaign
      WHERE campaign.status = ENABLED AND segments.date DURING LAST_30_DAYS
    `);
    let totalImpressions = 0, totalClicks = 0, totalCostMicros = 0, totalConversions = 0;
    for (const r of campaignRows) {
      totalImpressions += r.metrics?.impressions || 0;
      totalClicks += r.metrics?.clicks || 0;
      totalCostMicros += r.metrics?.cost_micros || 0;
      totalConversions += r.metrics?.conversions || 0;
    }

    // Ad group performance
    const adGroupRows = await customer.query(`
      SELECT ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.ctr, metrics.average_cpc
      FROM ad_group
      WHERE ad_group.status = ENABLED AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
    `);
    const adGroups = adGroupRows.map((r: any) => ({
      name: r.ad_group?.name,
      impressions: r.metrics?.impressions || 0,
      clicks: r.metrics?.clicks || 0,
      cost: (r.metrics?.cost_micros || 0) / 1e6,
      conversions: r.metrics?.conversions || 0,
      ctr: ((r.metrics?.ctr || 0) * 100).toFixed(1),
      avgCpc: ((r.metrics?.average_cpc || 0) / 1e6).toFixed(2),
    }));

    // Top keywords
    const keywordRows = await customer.query(`
      SELECT ad_group_criterion.keyword.text, ad_group.name,
             metrics.impressions, metrics.clicks, metrics.cost_micros,
             metrics.conversions, metrics.ctr, metrics.average_cpc
      FROM keyword_view
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.clicks DESC
      LIMIT 20
    `);
    const keywords = keywordRows.map((r: any) => ({
      keyword: r.ad_group_criterion?.keyword?.text,
      adGroup: r.ad_group?.name,
      impressions: r.metrics?.impressions || 0,
      clicks: r.metrics?.clicks || 0,
      cost: (r.metrics?.cost_micros || 0) / 1e6,
      conversions: r.metrics?.conversions || 0,
      ctr: ((r.metrics?.ctr || 0) * 100).toFixed(1),
      avgCpc: ((r.metrics?.average_cpc || 0) / 1e6).toFixed(2),
    }));

    // Top search terms
    const searchTermRows = await customer.query(`
      SELECT search_term_view.search_term,
             metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.clicks DESC
      LIMIT 15
    `);
    const searchTerms = searchTermRows.map((r: any) => ({
      term: r.search_term_view?.search_term,
      impressions: r.metrics?.impressions || 0,
      clicks: r.metrics?.clicks || 0,
      cost: (r.metrics?.cost_micros || 0) / 1e6,
      conversions: r.metrics?.conversions || 0,
    }));

    // Daily spend (last 14 days)
    const dailyRows = await customer.query(`
      SELECT segments.date, metrics.clicks, metrics.cost_micros, metrics.impressions, metrics.conversions
      FROM campaign
      WHERE campaign.status = ENABLED AND segments.date DURING LAST_14_DAYS
      ORDER BY segments.date
    `);
    const dailyMap = new Map<string, { clicks: number; cost: number; impressions: number; conversions: number }>();
    for (const r of dailyRows) {
      const date = r.segments?.date;
      const entry = dailyMap.get(date) || { clicks: 0, cost: 0, impressions: 0, conversions: 0 };
      entry.clicks += r.metrics?.clicks || 0;
      entry.cost += (r.metrics?.cost_micros || 0) / 1e6;
      entry.impressions += r.metrics?.impressions || 0;
      entry.conversions += r.metrics?.conversions || 0;
      dailyMap.set(date, entry);
    }
    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

    return {
      totalImpressions,
      totalClicks,
      totalCost: totalCostMicros / 1e6,
      totalConversions,
      avgCpc: totalClicks > 0 ? (totalCostMicros / 1e6 / totalClicks).toFixed(2) : "0",
      ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0",
      adGroups,
      keywords,
      searchTerms,
      daily,
    };
  } catch (error) {
    console.error("[ads-stats] Google Ads API error:", error);
    return null;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // On-site tracking data
    const visitCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM ad_visits WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= NOW() - INTERVAL '30 days'"
    );
    const visitsTodayRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM ad_visits WHERE utm_source = 'google' AND utm_medium = 'cpc' AND created_at >= CURRENT_DATE"
    );
    const signupsRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE utm_source = 'google'"
    );

    const adsBookings = await query<{
      id: string; total_price: number | null; payment_status: string | null;
      status: string; utm_term: string | null;
    }>(
      `SELECT id, total_price, payment_status, status, utm_term
       FROM bookings WHERE utm_source = 'google' AND utm_medium = 'cpc'
       ORDER BY created_at DESC`
    );
    const totalBookings = adsBookings.length;
    const paidBookings = adsBookings.filter(b => b.payment_status === "paid");
    const revenue = paidBookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);

    // Recent ad visitors with journey
    const recentVisitors = await query<{
      id: string; utm_term: string | null; utm_campaign: string | null;
      landing_page: string | null; created_at: string;
    }>(
      `SELECT id, utm_term, utm_campaign, landing_page, created_at FROM ad_visits
       WHERE utm_source = 'google' AND utm_medium = 'cpc'
       ORDER BY created_at DESC LIMIT 15`
    );
    const recentWithJourney = [];
    for (const v of recentVisitors) {
      const visitTime = new Date(v.created_at);
      const windowEnd = new Date(visitTime.getTime() + 30 * 60 * 1000);
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
      });
    }

    const visits = parseInt(visitCount?.count || "0");
    const signups = parseInt(signupsRow?.count || "0");

    // Google Ads API data
    const googleAds = await getGoogleAdsData();

    return NextResponse.json({
      // On-site funnel
      visits,
      visitsToday: parseInt(visitsTodayRow?.count || "0"),
      signups,
      bookingsFromAds: totalBookings,
      paidBookings: paidBookings.length,
      revenueFromAds: revenue,
      visitToBookingRate: visits > 0 ? ((totalBookings / visits) * 100).toFixed(1) : "0",
      bookingToPayRate: totalBookings > 0 ? ((paidBookings.length / totalBookings) * 100).toFixed(1) : "0",
      recentVisitors: recentWithJourney,
      // Google Ads API data
      googleAds,
    });
  } catch (error) {
    console.error("[admin/ads-stats] error:", error);
    return NextResponse.json(null);
  }
}
