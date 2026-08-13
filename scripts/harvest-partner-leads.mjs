// Harvest accommodation-side outreach leads into partner_outreach.
//
// Source is OpenStreetMap via Overpass: hotels, guest houses, apartments,
// chalets and hostels in this market. OSM is used rather than Maps scraping
// because the data is openly licensed (ODbL), structured, and already carries
// contact tags for a fifth of the rows.
//
// Two passes:
//   1. rows whose OSM tags already hold an email — free, instant;
//   2. rows with only a website — fetch their homepage and contact page and
//      pull the first sensible address out of the markup.
//
// Only places within RADIUS_KM of a location we actually cover are kept. A
// guest house four hours from the nearest photographer is not a lead — it's a
// complaint waiting to happen, and the coverage centres live in `locations`.
//
//   DRY=1 node scripts/harvest-partner-leads.mjs        # collect, print, insert nothing
//   SKIP_CRAWL=1 node scripts/harvest-partner-leads.mjs # tagged emails only
//   node scripts/harvest-partner-leads.mjs              # everything
//
// Everything lands as status 'new'. Nothing here can send an email: the cron
// only ever picks up rows a human moved to 'queued'.

import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DRY = process.env.DRY === "1";
const SKIP_CRAWL = process.env.SKIP_CRAWL === "1";
const RADIUS_KM = Number(process.env.RADIUS_KM || 35);
const CRAWL_CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 12);
const COUNTRY = (process.env.NEXT_PUBLIC_COUNTRY || process.env.COUNTRY || "pt").toLowerCase();

const ISO = { pt: "PT", es: "ES", it: "IT" }[COUNTRY];
if (!ISO) {
  console.error(`NEXT_PUBLIC_COUNTRY="${COUNTRY}" is not a market this script knows.`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const LODGING = "^(hotel|guest_house|apartment|hostel|chalet|resort|motel)$";

// Addresses that are never a person: platform noise, tracking, and the
// booking channels we are not trying to reach.
const EMAIL_BLOCKLIST =
  /(noreply|no-reply|donotreply|example\.|sentry\.|wixpress|@booking\.com|@airbnb|@expedia|@tripadvisor|@hostelworld|@sapo\.pt$|@gmail\.example|\.png$|\.jpg$|\.jpeg$|\.gif$|\.webp$|\.svg$)/i;

// Four at most, best-first. Each miss costs a request timeout, and at two
// thousand sites the tail of exotic contact-page names is not worth the hours.
const CONTACT_PATHS = ["", "/contact", "/contactos", "/contact-us"];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// The mirrors are shared infrastructure and answer a rejected query with an
// HTML page and HTTP 200, so both the status and the body shape are checked.
// The query goes as form data under `data=` — that is the documented
// interface, and text/plain gets a 406 from overpass-api.de.
async function overpass(query) {
  if (process.env.OSM_FILE) {
    console.log(`Reading OSM extract from ${process.env.OSM_FILE}`);
    return JSON.parse(readFileSync(process.env.OSM_FILE, "utf8"));
  }
  let lastError;
  for (let round = 0; round < 3; round++) {
    for (const endpoint of OVERPASS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(600_000),
        });
        const text = await res.text();
        if (!res.ok || text.trimStart().startsWith("<")) {
          throw new Error(`${endpoint} refused the query (${res.status})`);
        }
        return JSON.parse(text);
      } catch (e) {
        lastError = e;
        console.warn(`[overpass] ${e.message}`);
      }
    }
    const waitMs = 30_000 * (round + 1);
    console.warn(`[overpass] all mirrors busy — waiting ${waitMs / 1000}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw lastError;
}

// Coverage centres come from two places and both are needed: the `locations`
// table holds 7 rows on production, while the 30-odd real destinations live in
// src/lib/locations-data.ts. Filtering on the table alone would throw away
// every lead outside Lisbon, Porto, Sintra, Cascais, the Algarve and the
// islands — most of the country.
function locationsFromCode() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "locations-data.ts");
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const marker = `const locations${ISO}: Location[] = [`;
  const start = src.indexOf(marker);
  if (start === -1) return [];
  const end = src.indexOf("\n];", start);
  const block = src.slice(start, end === -1 ? undefined : end);

  const out = [];
  for (const chunk of block.split(/\n  \{/)) {
    const name = chunk.match(/\n?\s*name:\s*"([^"]+)"/)?.[1];
    const region = chunk.match(/\n?\s*region:\s*"([^"]+)"/)?.[1];
    const lat = parseFloat(chunk.match(/\n\s*lat:\s*(-?\d+\.?\d*)/)?.[1]);
    const lng = parseFloat(chunk.match(/\n\s*lng:\s*(-?\d+\.?\d*)/)?.[1]);
    if (name && Number.isFinite(lat) && Number.isFinite(lng)) out.push({ name, region: region || null, lat, lng });
  }
  return out;
}

function pickEmail(candidates, siteHost) {
  const clean = [...new Set(candidates.map((e) => e.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0]))]
    .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))
    .filter((e) => !EMAIL_BLOCKLIST.test(e));
  if (!clean.length) return null;
  // Prefer a mailbox on the company's own domain, then the usual front-desk
  // names — a personal address harvested off a page is more likely stale.
  const sameHost = siteHost ? clean.filter((e) => siteHost.includes(e.split("@")[1].replace(/^www\./, ""))) : [];
  const pool0 = sameHost.length ? sameHost : clean;
  const preferred = pool0.find((e) => /^(info|geral|reservas|reservations|booking|hello|contact|mail)@/.test(e));
  return preferred || pool0[0];
}

async function crawlEmail(website) {
  let base;
  try {
    base = new URL(website.startsWith("http") ? website : `https://${website}`);
  } catch {
    return null;
  }
  for (const path of CONTACT_PATHS) {
    try {
      const res = await fetch(new URL(path, base), {
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
        headers: {
          // Identify honestly, and point at a page that explains who we are.
          "User-Agent": "PhotoPortugalPartnerBot/1.0 (+https://photoportugal.com/about; partner outreach)",
          Accept: "text/html",
        },
      });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 400_000);
      const found = [
        ...(html.match(/mailto:([^"'?>\s]+)/gi) || []),
        ...(html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []),
      ];
      const email = pickEmail(found, base.host);
      if (email) return email;
    } catch {
      // A dead or slow site is the common case at this scale, not an incident.
    }
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
      if (i % 100 === 0 && i) process.stdout.write(`  …${i}/${items.length}\n`);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: dbCentres } = await client.query(
      `SELECT name, region, lat::float8 AS lat, lng::float8 AS lng
         FROM locations WHERE lat IS NOT NULL AND lng IS NOT NULL`
    );
    const centres = [...dbCentres];
    const seenCentre = new Set(dbCentres.map((c) => c.name.toLowerCase()));
    for (const c of locationsFromCode()) {
      if (!seenCentre.has(c.name.toLowerCase())) {
        centres.push(c);
        seenCentre.add(c.name.toLowerCase());
      }
    }
    if (!centres.length) {
      console.error("No locations with coordinates — nothing to measure coverage against.");
      process.exit(1);
    }
    console.log(`Coverage: ${centres.length} locations (${dbCentres.length} from the table), ${RADIUS_KM} km radius\n`);

    console.log("Querying Overpass…");
    const data = await overpass(`
[out:json][timeout:600];
area["ISO3166-1"="${ISO}"][admin_level=2]->.market;
(
  nwr["tourism"~"${LODGING}"](area.market);
);
out center tags;
`);
    console.log(`  ${data.elements.length} lodging places in OSM`);

    // Normalise, keep only what we cover, and remember which of our locations
    // it sits next to — that name is what the letter says.
    const leads = [];
    for (const el of data.elements) {
      const t = el.tags || {};
      if (!t.name) continue;
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;

      let nearest = null;
      let nearestKm = Infinity;
      for (const c of centres) {
        const km = haversineKm({ lat, lng }, c);
        if (km < nearestKm) {
          nearestKm = km;
          nearest = c;
        }
      }
      if (nearestKm > RADIUS_KM) continue;

      const email = pickEmail([t.email, t["contact:email"]].filter(Boolean), null);
      const website = t.website || t["contact:website"] || t.url || null;
      if (!email && !website) continue;

      leads.push({
        name: t.name.slice(0, 200),
        email,
        website: website ? website.slice(0, 500) : null,
        region: nearest.name,
        kind: t.tourism,
        city: t["addr:city"] || null,
        osm: `${el.type}/${el.id}`,
        km: Math.round(nearestKm),
      });
    }

    const tagged = leads.filter((l) => l.email).length;
    console.log(`  ${leads.length} within ${RADIUS_KM} km of a covered location (${tagged} already carry an email)\n`);

    const toCrawl = leads.filter((l) => !l.email && l.website);
    if (!SKIP_CRAWL && toCrawl.length) {
      console.log(`Crawling ${toCrawl.length} sites for a contact address (concurrency ${CRAWL_CONCURRENCY})…`);
      const found = await mapLimit(toCrawl, CRAWL_CONCURRENCY, (l) => crawlEmail(l.website));
      found.forEach((email, i) => { toCrawl[i].email = email; });
      console.log(`  ${found.filter(Boolean).length} addresses recovered\n`);
    }

    // One mailbox per company, and one company per domain: chains publish the
    // same reservations@ on twenty properties, and twenty identical letters to
    // one desk is the fastest way to be marked as spam.
    const seenEmail = new Set();
    const seenDomain = new Set();
    const final = [];
    for (const l of leads) {
      if (!l.email) continue;
      const domain = l.email.split("@")[1];
      if (seenEmail.has(l.email) || seenDomain.has(domain)) continue;
      seenEmail.add(l.email);
      seenDomain.add(domain);
      final.push(l);
    }
    console.log(`${final.length} unique mailable leads after dedup`);

    const byRegion = {};
    final.forEach((l) => { byRegion[l.region] = (byRegion[l.region] || 0) + 1; });
    console.log(Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 15));

    if (DRY) {
      console.log("\nDRY — nothing written. Sample:");
      console.table(final.slice(0, 10).map(({ name, email, region, kind, km }) => ({ name, email, region, kind, km })));
      return;
    }

    let inserted = 0;
    for (let i = 0; i < final.length; i += 200) {
      const batch = final.slice(i, i + 200);
      const values = [];
      const params = [];
      batch.forEach((l, n) => {
        const b = n * 6;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, 'hotel', $${b + 4}, 'new', $${b + 5}, $${b + 6})`);
        params.push(
          l.name,
          l.website,
          l.email,
          l.region,
          `${l.kind} · ${l.city || l.region} · ${l.km} km from ${l.region} · OSM ${l.osm}`,
          l.osm
        );
      });
      // The unique index is partial, so the conflict target has to name the
      // same predicate or Postgres cannot infer it.
      const res = await client.query(
        `INSERT INTO partner_outreach (company_name, website, email, segment, region, status, notes, osm_ref)
         VALUES ${values.join(", ")}
         ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING`,
        params
      );
      inserted += res.rowCount;
    }
    console.log(`\nInserted ${inserted} new rows (${final.length - inserted} already on the list).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
