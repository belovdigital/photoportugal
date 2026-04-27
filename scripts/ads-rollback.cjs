// Rollback Final URLs from a snapshot file in scripts/ads-snapshots/.
// Detects whether the snapshot is ads or keywords by entry shape (criterionId vs adId).
// Usage: node scripts/ads-rollback.cjs scripts/ads-snapshots/<file>.json
const { GoogleAdsApi } = require("google-ads-api");
const fs = require("fs");

const SNAPSHOT_PATH = process.argv[2];
if (!SNAPSHOT_PATH) {
  console.error("Usage: node scripts/ads-rollback.cjs <snapshot.json>");
  process.exit(1);
}

const client = new GoogleAdsApi({
  client_id: "133920543165-ivqtj2tlo2plokojo91qu2hgarhnese3.apps.googleusercontent.com",
  client_secret: "***REDACTED_CLIENT_SECRET***",
  developer_token: "***REDACTED_DEV_TOKEN***",
});
const customer = client.Customer({
  customer_id: "8533157376",
  refresh_token: "***REDACTED_REFRESH_TOKEN***",
});

(async () => {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  if (!snap.length) { console.log("Empty snapshot, nothing to do."); return; }

  const isKeywords = !!snap[0].criterionId;
  console.log(`Restoring ${snap.length} ${isKeywords ? "keywords" : "ads"} from ${SNAPSHOT_PATH}`);

  if (isKeywords) {
    const ops = snap.map(s => ({
      resource_name: `customers/8533157376/adGroupCriteria/${s.adGroupId}~${s.criterionId}`,
      final_urls: s.final_urls,
    }));
    const CHUNK = 100;
    let done = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const res = await customer.adGroupCriteria.update(ops.slice(i, i + CHUNK));
      done += res.results?.length || 0;
      if (res.partial_failure_error) console.log("Partial fail:", res.partial_failure_error);
    }
    console.log(`Restored ${done} keywords`);
  } else {
    const ops = snap.map(s => ({
      resource_name: `customers/8533157376/ads/${s.adId}`,
      final_urls: s.final_urls,
    }));
    const res = await customer.ads.update(ops);
    console.log(`Restored ${res.results?.length || 0} ads. partial_failure:`, res.partial_failure_error || "none");
  }
})().catch(e => { console.error("FATAL:", e.message || e); if (e.errors) console.error(JSON.stringify(e.errors,null,2)); process.exit(1); });
