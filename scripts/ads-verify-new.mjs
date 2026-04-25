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

const NEW = ["Setubal Photographers", "Aveiro Photographers", "Guimaraes Photographers", "Douro Valley Photographers", "Coimbra Photographers"];

for (const name of NEW) {
  const rows = await customer.query(`
    SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros, campaign.id,
           campaign.name
    FROM ad_group WHERE ad_group.name = '${name}'
  `);
  for (const r of rows) {
    console.log(`${r.ad_group.name} → campaign "${r.campaign.name}" (${r.campaign.id}) status=${r.ad_group.status} bid=€${Number(r.ad_group.cpc_bid_micros||0)/1e6}`);
  }

  const kws = await customer.query(`
    SELECT ad_group_criterion.keyword.text, ad_group_criterion.final_urls
    FROM keyword_view WHERE ad_group.name = '${name}' LIMIT 100
  `);
  const brokenUrls = kws.filter(k => !k.ad_group_criterion.final_urls?.[0]?.includes("/lp/"));
  console.log(`  keywords: ${kws.length}, broken URLs: ${brokenUrls.length}`);
  if (brokenUrls.length) for (const k of brokenUrls) console.log(`    BROKEN: "${k.ad_group_criterion.keyword.text}" → ${k.ad_group_criterion.final_urls?.[0]}`);

  const ads = await customer.query(`
    SELECT ad_group_ad.status, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group.name = '${name}'
  `);
  console.log(`  ads: ${ads.length} → ${ads[0]?.ad_group_ad?.ad?.final_urls?.[0]}`);
  console.log();
}
