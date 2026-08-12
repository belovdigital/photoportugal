// IndexNow integration — pings Bing/Yandex/Seznam about new/updated URLs
// so they crawl in minutes instead of days. Google does NOT accept
// IndexNow; for Google we still rely on the sitemap + organic discovery.
//
// Setup:
//   - Key file lives at /public/<key>.txt and serves the key as plaintext.
//   - Submit one URL via GET, or up to 10000 URLs via POST.
//   - We POST so a single approval can flush a photographer's new pages
//     (their detail page + every locations/<city>/<occasion> they show up
//     on) in one round-trip.

import { country } from "@/lib/country";

const KEY = "72b9a40a20bed6ebab49f7bd96c91eac";
// The host must be the one the submitted URLs actually live on, and the key
// file must be reachable there. `public/<key>.txt` is served by every market
// off the shared build, so one key covers all of them — verified 200 on
// photoportugal.com, photospain.co and photoitaly.co. Hardcoding Portugal
// here meant Spain and Italy were submitting their URLs under Portugal's
// host, which IndexNow rejects as a host mismatch.
const HOST = country.host;
const ENDPOINT = "https://api.indexnow.org/indexnow";

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;
  // Dedup + cap at 10k (IndexNow limit per request).
  const unique = Array.from(new Set(urls)).slice(0, 10000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "api.indexnow.org" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: unique,
      }),
    });
    if (!res.ok) {
      console.warn(`[indexnow] ${res.status} for ${unique.length} urls`);
    }
  } catch (err) {
    console.warn("[indexnow] fetch failed:", err);
  }
}
