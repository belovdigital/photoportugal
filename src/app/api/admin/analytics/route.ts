import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

const GA4_PROPERTY = process.env.GA4_PROPERTY_ID || "529197403";
const GSC_SITE = process.env.GSC_SITE_URL || "https://photoportugal.com";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const result: Record<string, unknown> = {};

  // ===== GA4 Data =====
  try {
    const analyticsClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Last 30 days overview
    const [overviewResponse] = await analyticsClient.runReport({
      property: `properties/${GA4_PROPERTY}`,
      dateRanges: [
        { startDate: "30daysAgo", endDate: "today" },
        { startDate: "60daysAgo", endDate: "31daysAgo" },
      ],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    });

    const current = overviewResponse.rows?.[0]?.metricValues || [];
    const previous = overviewResponse.rows?.[1]?.metricValues || [];

    result.ga4 = {
      period: "Last 30 days",
      users: parseInt(current[0]?.value || "0"),
      usersPrev: parseInt(previous[0]?.value || "0"),
      sessions: parseInt(current[1]?.value || "0"),
      sessionsPrev: parseInt(previous[1]?.value || "0"),
      pageviews: parseInt(current[2]?.value || "0"),
      pageviewsPrev: parseInt(previous[2]?.value || "0"),
      avgSessionDuration: Math.round(parseFloat(current[3]?.value || "0")),
      bounceRate: Math.round(parseFloat(current[4]?.value || "0") * 100),
    };

    // Top pages
    const [pagesResponse] = await analyticsClient.runReport({
      property: `properties/${GA4_PROPERTY}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 15,
    });

    result.topPages = (pagesResponse.rows || []).map((row) => ({
      path: row.dimensionValues?.[0]?.value,
      views: parseInt(row.metricValues?.[0]?.value || "0"),
      users: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    // Traffic sources
    const [sourcesResponse] = await analyticsClient.runReport({
      property: `properties/${GA4_PROPERTY}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });

    result.trafficSources = (sourcesResponse.rows || []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value,
      sessions: parseInt(row.metricValues?.[0]?.value || "0"),
      users: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    // Top countries
    const [countriesResponse] = await analyticsClient.runReport({
      property: `properties/${GA4_PROPERTY}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    });

    result.topCountries = (countriesResponse.rows || []).map((row) => ({
      country: row.dimensionValues?.[0]?.value,
      users: parseInt(row.metricValues?.[0]?.value || "0"),
    }));

    // Funnel events
    const [funnelResponse] = await analyticsClient.runReport({
      property: `properties/${GA4_PROPERTY}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: ["page_view", "search", "view_item", "add_to_cart", "begin_checkout", "purchase", "delivery_accepted", "review_submitted", "sign_up"],
          },
        },
      },
    });

    const funnelMap: Record<string, number> = {};
    for (const row of funnelResponse.rows || []) {
      const name = row.dimensionValues?.[0]?.value || "";
      funnelMap[name] = parseInt(row.metricValues?.[0]?.value || "0");
    }
    result.funnel = funnelMap;

  } catch (err) {
    result.ga4Error = `GA4 error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ===== Google Search Console =====
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });

    const searchConsole = google.searchconsole({ version: "v1", auth });

    const now = new Date();
    const endDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago (GSC delay)
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // Overall performance
    const { data: performance } = await searchConsole.searchanalytics.query({
      siteUrl: GSC_SITE,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: [],
      },
    });

    const row0 = performance.rows?.[0];
    result.gsc = {
      period: `${fmt(startDate)} — ${fmt(endDate)}`,
      clicks: row0?.clicks || 0,
      impressions: row0?.impressions || 0,
      ctr: Math.round((row0?.ctr || 0) * 1000) / 10,
      position: Math.round((row0?.position || 0) * 10) / 10,
    };

    // Top queries (fetch more for position distribution)
    const { data: queries } = await searchConsole.searchanalytics.query({
      siteUrl: GSC_SITE,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 500,
      },
    });

    const allQueries = (queries.rows || []).map((r) => ({
      query: r.keys?.[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 1000) / 10,
      position: Math.round((r.position || 0) * 10) / 10,
    }));

    // Position distribution (like Semrush)
    const top3 = allQueries.filter((q) => q.position <= 3);
    const top10 = allQueries.filter((q) => q.position <= 10);
    const top20 = allQueries.filter((q) => q.position <= 20);
    const top100 = allQueries.filter((q) => q.position <= 100);

    result.positionDistribution = {
      top3: { count: top3.length, queries: top3.slice(0, 10) },
      top10: { count: top10.length, queries: top10.slice(0, 15) },
      top20: { count: top20.length, queries: top20.filter((q) => q.position > 10).slice(0, 10) },
      top100: { count: top100.length, queries: top100.filter((q) => q.position > 20).slice(0, 10) },
      total: allQueries.length,
    };

    result.topQueries = allQueries.slice(0, 20);

    // Top pages in search
    const { data: pages } = await searchConsole.searchanalytics.query({
      siteUrl: GSC_SITE,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["page"],
        rowLimit: 15,
      },
    });

    result.topSearchPages = (pages.rows || []).map((r) => ({
      page: r.keys?.[0]?.replace(GSC_SITE, ""),
      clicks: r.clicks,
      impressions: r.impressions,
      position: Math.round((r.position || 0) * 10) / 10,
    }));

  } catch (err) {
    result.gscError = `GSC error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ===== Smart Insights (from DB + analytics) =====
  try {
    const ga4 = result.ga4 as Record<string, number> | undefined;
    const gsc = result.gsc as Record<string, number> | undefined;
    const insights: string[] = [];

    if (ga4) {
      if (ga4.users > 0 && ga4.usersPrev > 0) {
        const change = Math.round(((ga4.users - ga4.usersPrev) / ga4.usersPrev) * 100);
        if (change > 10) insights.push(`Traffic is up ${change}% vs previous period — keep it up!`);
        else if (change < -10) insights.push(`Traffic is down ${change}% vs previous period — consider promoting content or ads.`);
        else insights.push(`Traffic is stable (${change > 0 ? "+" : ""}${change}% vs previous period).`);
      }
      if (ga4.bounceRate > 70) insights.push(`Bounce rate is ${ga4.bounceRate}% — consider improving page load speed or content relevance.`);
      if (ga4.avgSessionDuration < 30) insights.push(`Average session is only ${ga4.avgSessionDuration}s — users leave quickly. Improve above-the-fold content.`);
      else if (ga4.avgSessionDuration > 120) insights.push(`Users spend ${Math.round(ga4.avgSessionDuration / 60)} min on average — great engagement!`);
    }

    if (gsc) {
      if (gsc.position > 30) insights.push(`Average search position is ${gsc.position} — most pages aren't on page 1 yet. Normal for a new site.`);
      else if (gsc.position < 15) insights.push(`Average search position is ${gsc.position} — you're getting close to page 1!`);
      if (gsc.clicks === 0) insights.push(`No organic clicks yet — Google is still indexing. Focus on content + backlinks.`);
    }

    // DB-based insights
    const bookingsThisMonth = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM bookings WHERE created_at >= date_trunc('month', CURRENT_DATE)"
    );
    const bookingsCount = parseInt(bookingsThisMonth?.count || "0");
    if (bookingsCount === 0) insights.push("No bookings this month yet. Consider running Google Ads for key locations.");
    else insights.push(`${bookingsCount} booking${bookingsCount !== 1 ? "s" : ""} this month.`);

    result.insights = insights;
  } catch {
    result.insights = ["Could not generate insights."];
  }

  return NextResponse.json(result);
}
