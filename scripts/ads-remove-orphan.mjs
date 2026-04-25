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

const r = await customer.adGroups.remove(["customers/8533157376/adGroups/192846919341"]);
console.log("Removed:", r.results?.[0]?.resource_name);
