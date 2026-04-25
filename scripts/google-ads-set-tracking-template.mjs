// Set a tracking_url_template on every campaign so utm_term and other UTM
// parameters are appended automatically. Without this, only `gclid` reaches
// the landing page (auto-tagging) and the admin "visitors" page can't show
// the search query that triggered the click.
//
// Usage on server: node scripts/google-ads-set-tracking-template.mjs

import { GoogleAdsApi } from "google-ads-api";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n")
    .filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...r] = l.split("=");
      return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")];
    }),
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

// {lpurl} = the ad's final URL with already-encoded querystring stripped/escaped.
// Append our standard UTMs + ValueTrack params so the tracking pipeline can
// record utm_term (= keyword that matched). gclid is auto-appended by Google.
const TEMPLATE =
  "{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}&utm_term={keyword}";

const rows = await customer.query(`
  SELECT campaign.resource_name, campaign.name, campaign.tracking_url_template
  FROM campaign
  WHERE campaign.status != 'REMOVED'
`);

console.log(`Found ${rows.length} campaigns.`);

const updates = rows
  .filter((r) => (r.campaign?.tracking_url_template || "") !== TEMPLATE)
  .map((r) => ({
    resource_name: r.campaign.resource_name,
    tracking_url_template: TEMPLATE,
  }));

console.log(`Updating ${updates.length} campaigns…`);
if (updates.length > 0) {
  await customer.campaigns.update(updates);
  for (const u of updates) console.log(`  ✓ ${u.resource_name}`);
}
console.log("\nDone. New clicks will arrive with utm_term + utm_campaign.");
