// Quick read-only test for Google Ads API access. Lists campaigns + ad groups + sample keywords.
// Usage on server: node scripts/google-ads-test.mjs

import { GoogleAdsApi } from "google-ads-api";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^["']|["']$/g, "")];
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

console.log("[ads] querying campaigns...");
const campaigns = await customer.query(`
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign_budget.amount_micros
  FROM campaign
`);
console.log(`[ads] ${campaigns.length} campaigns:`);
for (const r of campaigns) {
  console.log(`  ${r.campaign.id} | ${r.campaign.status} | ${r.campaign.advertising_channel_type} | €${(Number(r.campaign_budget?.amount_micros || 0) / 1_000_000).toFixed(2)} | ${r.campaign.name}`);
}

console.log("\n[ads] querying ad groups...");
const adGroups = await customer.query(`
  SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, campaign.name
  FROM ad_group
  WHERE ad_group.status != 'REMOVED'
`);
console.log(`[ads] ${adGroups.length} ad groups:`);
for (const r of adGroups.slice(0, 20)) {
  console.log(`  ${r.ad_group.id} | ${r.ad_group.status} | ${r.campaign.name} > ${r.ad_group.name}`);
}

console.log("\n[ads] sample keywords (first 30)...");
const kws = await customer.query(`
  SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group.name, campaign.name
  FROM keyword_view
  WHERE ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED'
  LIMIT 30
`);
for (const r of kws) {
  console.log(`  [${r.ad_group_criterion.keyword.match_type}] "${r.ad_group_criterion.keyword.text}" — ${r.campaign.name} > ${r.ad_group.name}`);
}

console.log("\n[ads] geo targets per campaign (first 10)...");
const geoTargets = await customer.query(`
  SELECT campaign_criterion.location.geo_target_constant, campaign.name, campaign_criterion.negative
  FROM campaign_criterion
  WHERE campaign_criterion.type = 'LOCATION'
  LIMIT 10
`);
for (const r of geoTargets) {
  console.log(`  ${r.campaign.name} — ${r.campaign_criterion.location?.geo_target_constant} (neg: ${r.campaign_criterion.negative})`);
}

console.log("\n[ads] language targets per campaign...");
const langs = await customer.query(`
  SELECT campaign_criterion.language.language_constant, campaign.name
  FROM campaign_criterion
  WHERE campaign_criterion.type = 'LANGUAGE'
`);
for (const r of langs) {
  console.log(`  ${r.campaign.name} — ${r.campaign_criterion.language?.language_constant}`);
}
