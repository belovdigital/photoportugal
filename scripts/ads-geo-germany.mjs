import { GoogleAdsApi } from "google-ads-api";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const client = new GoogleAdsApi({
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const customer = client.Customer({
  customer_id: env.GOOGLE_ADS_CUSTOMER_ID,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
});

// Country performance — last 30d and last 90d
for (const period of ["LAST_30_DAYS", "LAST_90_DAYS"]) {
  console.log(`\n=== ${period} ===`);
  const rows = await customer.query(`
    SELECT
      user_location_view.country_criterion_id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM user_location_view
    WHERE segments.date DURING ${period}
  `);

  // Aggregate by country_criterion_id
  const byCountry = new Map();
  for (const r of rows) {
    const cid = r.user_location_view.country_criterion_id;
    const e = byCountry.get(cid) || { impr: 0, clicks: 0, cost: 0, conv: 0 };
    e.impr += Number(r.metrics?.impressions || 0);
    e.clicks += Number(r.metrics?.clicks || 0);
    e.cost += Number(r.metrics?.cost_micros || 0) / 1e6;
    e.conv += Number(r.metrics?.conversions || 0);
    byCountry.set(cid, e);
  }

  // Sort by spend desc
  const sorted = [...byCountry.entries()].sort((a, b) => b[1].cost - a[1].cost);
  console.log("Top 15 countries by spend:");
  console.log("cid\t\timpr\tclicks\tcost\tCTR%\tCPC\tconv");
  for (const [cid, s] of sorted.slice(0, 15)) {
    const ctr = s.impr ? (s.clicks / s.impr * 100).toFixed(2) : "0";
    const cpc = s.clicks ? (s.cost / s.clicks).toFixed(2) : "0";
    console.log(`${cid}\t${s.impr}\t${s.clicks}\t€${s.cost.toFixed(2)}\t${ctr}%\t€${cpc}\t${s.conv.toFixed(1)}`);
  }
}
