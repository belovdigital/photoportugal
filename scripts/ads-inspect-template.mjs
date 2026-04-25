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

console.log("=== CAMPAIGNS ===");
const camps = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
         campaign.bidding_strategy_type, campaign.maximize_conversions.target_cpa_micros,
         campaign_budget.amount_micros, campaign.final_url_suffix
  FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 20
`);
for (const c of camps) {
  console.log(`id=${c.campaign.id} "${c.campaign.name}" status=${c.campaign.status} ch=${c.campaign.advertising_channel_type} bid=${c.campaign.bidding_strategy_type} budget=€${Number(c.campaign_budget?.amount_micros || 0)/1e6}/day`);
  if (c.campaign.maximize_conversions?.target_cpa_micros) console.log(`  target_cpa=€${Number(c.campaign.maximize_conversions.target_cpa_micros)/1e6}`);
  console.log(`  url_suffix="${c.campaign.final_url_suffix || ''}"`);
}

console.log("\n=== AD GROUP: Lisbon Photographers ===");
const ag = await customer.query(`
  SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros, campaign.id
  FROM ad_group WHERE ad_group.name = 'Lisbon Photographers' AND ad_group.status != 'REMOVED' LIMIT 1
`);
for (const a of ag) {
  console.log(`id=${a.ad_group.id} campaign=${a.campaign.id} status=${a.ad_group.status} cpc_bid=€${Number(a.ad_group.cpc_bid_micros || 0)/1e6}`);
}

console.log("\n=== KEYWORDS in Lisbon Photographers ===");
const kws = await customer.query(`
  SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
         ad_group_criterion.final_urls, ad_group_criterion.cpc_bid_micros, ad_group_criterion.status
  FROM keyword_view
  WHERE ad_group.name = 'Lisbon Photographers' AND ad_group_criterion.status != 'REMOVED'
  LIMIT 100
`);
for (const k of kws) {
  const mt = ["UNKNOWN","UNSPECIFIED","EXACT","PHRASE","BROAD"][k.ad_group_criterion.keyword.match_type] || k.ad_group_criterion.keyword.match_type;
  console.log(`  "${k.ad_group_criterion.keyword.text}" [${mt}] → ${k.ad_group_criterion.final_urls?.[0] || "(inherit)"} bid=€${Number(k.ad_group_criterion.cpc_bid_micros || 0)/1e6}`);
}

console.log("\n=== RESPONSIVE SEARCH ADS in Lisbon Photographers ===");
const ads = await customer.query(`
  SELECT ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
         ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1,
         ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.status
  FROM ad_group_ad
  WHERE ad_group.name = 'Lisbon Photographers' AND ad_group_ad.status != 'REMOVED'
  LIMIT 5
`);
for (const a of ads) {
  console.log(`  Final URL: ${a.ad_group_ad.ad.final_urls?.[0]}`);
  console.log(`  Path: /${a.ad_group_ad.ad.responsive_search_ad?.path1 || ""}/${a.ad_group_ad.ad.responsive_search_ad?.path2 || ""}`);
  console.log(`  Headlines: ${a.ad_group_ad.ad.responsive_search_ad?.headlines?.map(h => h.text).join(" | ")}`);
  console.log(`  Descriptions: ${a.ad_group_ad.ad.responsive_search_ad?.descriptions?.map(d => d.text).join(" | ")}`);
}
