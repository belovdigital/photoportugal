import { query, withTransaction } from "@/lib/db";
import { canonicalizeShootType } from "@/lib/shoot-type-labels";

/**
 * Rollup behind /dashboard/stats: recomputes photographer_daily_stats
 * (and portfolio_item_daily_stats) for a range of Europe/Lisbon days.
 *
 * Inputs already collected elsewhere:
 *   - visitor_sessions.pageviews  → profile views, uniques, countries,
 *     devices, sources, returning visitors, URL-derived intent
 *   - photographer_events         → card impressions/clicks, photo opens
 *   - concierge_recommendation_events → concierge shows/clicks
 *   - bookings                    → inquiries, paid (cohort by created day)
 *
 * Fully idempotent: metric columns for the range are zeroed and
 * re-derived on every run (so late payments and bot re-classification
 * self-heal); gsc_* columns are owned by pullGscProfileStats() and are
 * never touched by the main rollup.
 *
 * Money never enters this module — see db/photographer-analytics.sql.
 */

/** Localized URL segments — must mirror src/i18n/routing.ts pathnames. */
const LOCALE_PREFIX = "(?:/(?:pt|de|es|fr))?";
const PROFILE_SEGMENTS = "(?:photographers|fotografen|fotografos|photographes)";
const LOCATION_SEGMENTS = "(?:locations|orte|lugares|lieux)";
const SHOOT_TYPE_SEGMENTS = "(?:photoshoots|fotoshootings|sesiones-de-fotos|seances-photo)";
const WEDDING_SEGMENTS = "(?:weddings|hochzeiten|bodas|mariages)";

const PROFILE_PATH_RE = `^${LOCALE_PREFIX}/${PROFILE_SEGMENTS}/([a-z0-9-]+)/?$`;
const LOCATION_OCCASION_RE = `^${LOCALE_PREFIX}/${LOCATION_SEGMENTS}/[a-z0-9-]+/([a-z0-9-]+)/?$`;
const SHOOT_TYPE_PATH_RE = `^${LOCALE_PREFIX}/${SHOOT_TYPE_SEGMENTS}/([a-z0-9-]+)/?$`;
const WEDDING_PATH_RE = `^${LOCALE_PREFIX}/${WEDDING_SEGMENTS}/?$`;

const TZ = "Europe/Lisbon";
const EVENTS_RETENTION_DAYS = 120;
/** Cap breakdown JSONB keys so a bot burst can't bloat rows. */
const MAX_BREAKDOWN_KEYS = 12;

export interface RollupSummary {
  from: string;
  to: string;
  dailyRowsUpserted: number;
  photoRowsUpserted: number;
  eventsPruned: number;
}

interface Key {
  photographerId: string;
  day: string;
}

function keyOf(row: { photographer_id: string; day: string }): string {
  return `${row.photographer_id}|${row.day}`;
}

/** Fold {name → count} rows into a capped object, extras under "other". */
function foldBreakdown(entries: { name: string | null; count: number }[]): Record<string, number> {
  const sorted = entries
    .filter((e) => e.count > 0)
    .map((e) => ({ name: e.name || "unknown", count: e.count }))
    .sort((a, b) => b.count - a.count);
  const out: Record<string, number> = {};
  for (const { name, count } of sorted) {
    if (Object.keys(out).length < MAX_BREAKDOWN_KEYS) out[name] = (out[name] || 0) + count;
    else out.other = (out.other || 0) + count;
  }
  return out;
}

function assertIsoDate(s: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${label} must be YYYY-MM-DD, got: ${s}`);
}

export async function rollupPhotographerStats(opts: {
  from: string;
  to: string;
  prune?: boolean;
}): Promise<RollupSummary> {
  const { from, to, prune = false } = opts;
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");

  interface DailyAccumulator {
    profile_views: number;
    unique_visitors: number;
    returning_visitors: number;
    card_impressions: number;
    card_clicks: number;
    photo_opens: number;
    book_opens: number;
    concierge_impressions: number;
    concierge_clicks: number;
    inquiries: number;
    paid_bookings: number;
    countries: Record<string, number>;
    devices: Record<string, number>;
    sources: Record<string, number>;
    intents: Record<string, number>;
    surfaces: Record<string, number>;
    missed_matches: Record<string, number>;
  }

  const acc = new Map<string, DailyAccumulator>();
  const keys = new Map<string, Key>();
  function bucket(row: { photographer_id: string; day: string }): DailyAccumulator {
    const k = keyOf(row);
    let b = acc.get(k);
    if (!b) {
      b = {
        profile_views: 0, unique_visitors: 0, returning_visitors: 0,
        card_impressions: 0, card_clicks: 0, photo_opens: 0, book_opens: 0,
        concierge_impressions: 0, concierge_clicks: 0,
        inquiries: 0, paid_bookings: 0,
        countries: {}, devices: {}, sources: {}, intents: {}, surfaces: {}, missed_matches: {},
      };
      acc.set(k, b);
      keys.set(k, { photographerId: row.photographer_id, day: row.day });
    }
    return b;
  }

  let photoRowsUpserted = 0;

  await withTransaction(async (client) => {
    // ── 1. Profile views from visitor_sessions.pageviews ──────────────
    // One temp row per matched profile pageview. Bot sessions and the
    // photographer's own sessions are excluded here so every downstream
    // aggregate inherits the filter. started_at prefilter (±buffer)
    // keeps the LATERAL scan bounded; the per-pageview `day` filter is
    // what actually defines the window.
    await client.query(
      `CREATE TEMP TABLE tmp_pp_views ON COMMIT DROP AS
       SELECT
         pp.id AS photographer_id,
         ((elem->>'ts')::timestamptz AT TIME ZONE '${TZ}')::date::text AS day,
         vs.visitor_id,
         vs.country,
         vs.device_type,
         CASE
           WHEN vs.gclid IS NOT NULL OR lower(COALESCE(vs.utm_medium, '')) = 'cpc' THEN 'google_ads'
           WHEN lower(COALESCE(vs.utm_source, '')) = 'google' OR vs.referrer ILIKE '%google.%' THEN 'google'
           WHEN vs.utm_source IS NOT NULL THEN lower(vs.utm_source)
           WHEN vs.referrer ILIKE '%bing.%' OR vs.referrer ILIKE '%duckduckgo%' OR vs.referrer ILIKE '%yandex%' OR vs.referrer ILIKE '%ecosia%' THEN 'search_other'
           WHEN vs.referrer ILIKE '%photoportugal%' THEN 'internal'
           WHEN COALESCE(vs.referrer, '') = '' THEN 'direct'
           ELSE 'referral'
         END AS source,
         vs.pageviews
       FROM visitor_sessions vs
       CROSS JOIN LATERAL jsonb_array_elements(vs.pageviews) AS elem
       JOIN photographer_profiles pp
         ON pp.slug = substring(elem->>'path' FROM '${PROFILE_PATH_RE}')
       WHERE vs.started_at >= $1::date - INTERVAL '1 day'
         AND vs.started_at < $2::date + INTERVAL '2 days'
         AND vs.is_bot = FALSE
         AND vs.visitor_id IS NOT NULL
         AND (vs.user_id IS NULL OR vs.user_id <> pp.user_id)
         AND ((elem->>'ts')::timestamptz AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date`,
      [from, to],
    );

    // ── 2. Views / uniques ────────────────────────────────────────────
    const base = (await client.query(
      `SELECT photographer_id, day, COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS uniques
       FROM tmp_pp_views GROUP BY 1, 2`,
    )).rows as { photographer_id: string; day: string; views: number; uniques: number }[];
    for (const r of base) {
      const b = bucket(r);
      b.profile_views = r.views;
      b.unique_visitors = r.uniques;
    }

    // ── 3. Breakdowns (unique visitors per country/device/source) ─────
    for (const dim of ["country", "device_type", "source"] as const) {
      const rows = (await client.query(
        `SELECT photographer_id, day, ${dim} AS name, COUNT(DISTINCT visitor_id)::int AS count
         FROM tmp_pp_views GROUP BY 1, 2, 3`,
      )).rows as { photographer_id: string; day: string; name: string | null; count: number }[];
      const grouped = new Map<string, { name: string | null; count: number }[]>();
      for (const r of rows) {
        const k = keyOf(r);
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push({ name: r.name, count: r.count });
        bucket(r);
      }
      const field = dim === "country" ? "countries" : dim === "device_type" ? "devices" : "sources";
      for (const [k, entries] of grouped) {
        (acc.get(k)![field] as Record<string, number>) = foldBreakdown(entries);
      }
    }

    // ── 4. Returning visitors ─────────────────────────────────────────
    // Upsert-first with LEAST() keeps first_date correct even when a
    // backfill runs for an OLDER range after newer days were processed.
    await client.query(
      `INSERT INTO photographer_visitor_first_seen (photographer_id, visitor_id, first_date)
       SELECT photographer_id, visitor_id, MIN(day::date) FROM tmp_pp_views GROUP BY 1, 2
       ON CONFLICT (photographer_id, visitor_id)
       DO UPDATE SET first_date = LEAST(photographer_visitor_first_seen.first_date, EXCLUDED.first_date)`,
    );
    const returning = (await client.query(
      `SELECT t.photographer_id, t.day, COUNT(DISTINCT t.visitor_id)::int AS count
       FROM (SELECT DISTINCT photographer_id, day, visitor_id FROM tmp_pp_views) t
       JOIN photographer_visitor_first_seen fs
         ON fs.photographer_id = t.photographer_id AND fs.visitor_id = t.visitor_id
       WHERE fs.first_date < t.day::date
       GROUP BY 1, 2`,
    )).rows as { photographer_id: string; day: string; count: number }[];
    for (const r of returning) bucket(r).returning_visitors = r.count;

    // ── 5. Visitor intent ─────────────────────────────────────────────
    // Strongest signal wins: the visitor's own inquiry occasion, then
    // their concierge chat, then shoot-type/occasion pages they browsed
    // in the same session. Canonicalization happens in TS because
    // legacy occasion values ("Wedding", "solo") need CANONICAL_BY_NORM.
    const intentRows = (await client.query(
      `SELECT DISTINCT ON (t.photographer_id, t.day, t.visitor_id)
         t.photographer_id, t.day, t.visitor_id,
         bk.occasion  AS booking_occ,
         cc.occasion  AS concierge_occ,
         (SELECT substring(e2->>'path' FROM '${LOCATION_OCCASION_RE}')
            FROM jsonb_array_elements(t.pageviews) e2
           WHERE (e2->>'path') ~ '${LOCATION_OCCASION_RE}' LIMIT 1) AS loc_occ,
         (SELECT substring(e3->>'path' FROM '${SHOOT_TYPE_PATH_RE}')
            FROM jsonb_array_elements(t.pageviews) e3
           WHERE (e3->>'path') ~ '${SHOOT_TYPE_PATH_RE}' LIMIT 1) AS shoot_occ,
         (CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(t.pageviews) e4
             WHERE (e4->>'path') ~ '${WEDDING_PATH_RE}') THEN 'wedding' END) AS wedding_occ
       FROM tmp_pp_views t
       LEFT JOIN LATERAL (
         SELECT occasion FROM bookings b
          WHERE b.visitor_id = t.visitor_id AND b.occasion IS NOT NULL
          ORDER BY b.created_at DESC LIMIT 1) bk ON TRUE
       LEFT JOIN LATERAL (
         SELECT occasion FROM concierge_chats c
          WHERE c.visitor_id = t.visitor_id AND c.occasion IS NOT NULL
          ORDER BY c.created_at DESC LIMIT 1) cc ON TRUE`,
    )).rows as {
      photographer_id: string; day: string; visitor_id: string;
      booking_occ: string | null; concierge_occ: string | null;
      loc_occ: string | null; shoot_occ: string | null; wedding_occ: string | null;
    }[];
    const intentCounts = new Map<string, Map<string, number>>();
    for (const r of intentRows) {
      const raw = r.booking_occ || r.concierge_occ || r.loc_occ || r.shoot_occ || r.wedding_occ;
      const intent = (raw && canonicalizeShootType(raw)) || "unknown";
      const k = keyOf(r);
      bucket(r);
      if (!intentCounts.has(k)) intentCounts.set(k, new Map());
      const m = intentCounts.get(k)!;
      m.set(intent, (m.get(intent) || 0) + 1);
    }
    for (const [k, m] of intentCounts) {
      acc.get(k)!.intents = foldBreakdown([...m.entries()].map(([name, count]) => ({ name, count })));
    }

    // ── 6. Card events (impressions exclude the concierge surface —
    //       concierge_impressions from rec-events is authoritative there;
    //       clicks in concierge come via clicked_profile_at, not cards) ──
    const eventRows = (await client.query(
      `SELECT e.photographer_id,
              ((e.occurred_at AT TIME ZONE '${TZ}')::date)::text AS day,
              COUNT(*) FILTER (WHERE e.event_type = 'card_impression' AND COALESCE(e.surface, '') <> 'concierge')::int AS impressions,
              COUNT(*) FILTER (WHERE e.event_type = 'card_click')::int AS clicks,
              COUNT(*) FILTER (WHERE e.event_type = 'photo_open')::int AS photo_opens,
              COUNT(*) FILTER (WHERE e.event_type = 'book_open')::int AS book_opens
       FROM photographer_events e
       WHERE (e.occurred_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
         AND NOT EXISTS (
           SELECT 1 FROM visitor_sessions bvs
            WHERE bvs.visitor_id = e.visitor_id AND bvs.is_bot = TRUE)
         AND NOT EXISTS (
           SELECT 1 FROM users u JOIN photographer_profiles pp ON pp.user_id = u.id
            WHERE pp.id = e.photographer_id AND u.visitor_id = e.visitor_id)
       GROUP BY 1, 2`,
      [from, to],
    )).rows as { photographer_id: string; day: string; impressions: number; clicks: number; photo_opens: number; book_opens: number }[];
    for (const r of eventRows) {
      const b = bucket(r);
      b.card_impressions = r.impressions;
      b.card_clicks = r.clicks;
      b.photo_opens = r.photo_opens;
      b.book_opens = r.book_opens;
    }

    const surfaceRows = (await client.query(
      `SELECT e.photographer_id,
              ((e.occurred_at AT TIME ZONE '${TZ}')::date)::text AS day,
              COALESCE(e.surface, 'other') AS name,
              COUNT(*)::int AS count
       FROM photographer_events e
       WHERE e.event_type = 'card_impression'
         AND (e.occurred_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
         AND NOT EXISTS (
           SELECT 1 FROM visitor_sessions bvs
            WHERE bvs.visitor_id = e.visitor_id AND bvs.is_bot = TRUE)
       GROUP BY 1, 2, 3`,
      [from, to],
    )).rows as { photographer_id: string; day: string; name: string; count: number }[];
    {
      const grouped = new Map<string, { name: string; count: number }[]>();
      for (const r of surfaceRows) {
        const k = keyOf(r);
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push({ name: r.name, count: r.count });
        bucket(r);
      }
      for (const [k, entries] of grouped) acc.get(k)!.surfaces = foldBreakdown(entries);
    }

    // ── 7. Per-photo daily opens ──────────────────────────────────────
    const photoUpsert = await client.query(
      `INSERT INTO portfolio_item_daily_stats (item_id, photographer_id, date, opens)
       SELECT e.item_id, e.photographer_id, (e.occurred_at AT TIME ZONE '${TZ}')::date, COUNT(*)::int
       FROM photographer_events e
       JOIN portfolio_items pi ON pi.id = e.item_id
       WHERE e.event_type = 'photo_open' AND e.item_id IS NOT NULL
         AND (e.occurred_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
       GROUP BY 1, 2, 3
       ON CONFLICT (item_id, date) DO UPDATE SET opens = EXCLUDED.opens`,
      [from, to],
    );
    photoRowsUpserted = photoUpsert.rowCount || 0;

    // ── 8. Concierge funnel ───────────────────────────────────────────
    const conciergeRows = (await client.query(
      `SELECT photographer_id, day, SUM(impressions)::int AS impressions, SUM(clicks)::int AS clicks
       FROM (
         SELECT photographer_id, ((shown_at AT TIME ZONE '${TZ}')::date)::text AS day, COUNT(*)::int AS impressions, 0 AS clicks
         FROM concierge_recommendation_events
         WHERE (shown_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
         GROUP BY 1, 2
         UNION ALL
         SELECT photographer_id, ((clicked_profile_at AT TIME ZONE '${TZ}')::date)::text AS day, 0, COUNT(*)::int
         FROM concierge_recommendation_events
         WHERE clicked_profile_at IS NOT NULL
           AND (clicked_profile_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
         GROUP BY 1, 2
       ) u GROUP BY 1, 2`,
      [from, to],
    )).rows as { photographer_id: string; day: string; impressions: number; clicks: number }[];
    for (const r of conciergeRows) {
      const b = bucket(r);
      b.concierge_impressions = r.impressions;
      b.concierge_clicks = r.clicks;
    }

    // ── 8b. Missed concierge matches by reason ────────────────────────
    const missedRows = (await client.query(
      `SELECT photographer_id, ((occurred_at AT TIME ZONE '${TZ}')::date)::text AS day,
              reason AS name, COUNT(*)::int AS count
       FROM concierge_exclusion_events
       WHERE (occurred_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
       GROUP BY 1, 2, 3`,
      [from, to],
    )).rows as { photographer_id: string; day: string; name: string; count: number }[];
    {
      const grouped = new Map<string, { name: string; count: number }[]>();
      for (const r of missedRows) {
        const k = keyOf(r);
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push({ name: r.name, count: r.count });
        bucket(r);
      }
      for (const [k, entries] of grouped) acc.get(k)!.missed_matches = foldBreakdown(entries);
    }

    // ── 9. Inquiries / paid (cohort by created day) ───────────────────
    // photographer_id IS NULL = blind booking not yet assigned; it starts
    // counting for the assigned photographer once the trailing-window
    // recompute sees the assignment.
    const bookingRows = (await client.query(
      `SELECT photographer_id, ((created_at AT TIME ZONE '${TZ}')::date)::text AS day,
              COUNT(*)::int AS inquiries,
              COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid
       FROM bookings
       WHERE photographer_id IS NOT NULL
         AND (created_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date
       GROUP BY 1, 2`,
      [from, to],
    )).rows as { photographer_id: string; day: string; inquiries: number; paid: number }[];
    for (const r of bookingRows) {
      const b = bucket(r);
      b.inquiries = r.inquiries;
      b.paid_bookings = r.paid;
    }

    // ── 10. Zero out the range (gsc_* untouched), then upsert ─────────
    // Without the zero-out, a day whose activity disappears on recompute
    // (e.g. sessions re-flagged as bots) would keep its stale numbers.
    await client.query(
      `UPDATE photographer_daily_stats SET
         profile_views = 0, unique_visitors = 0, returning_visitors = 0,
         card_impressions = 0, card_clicks = 0, photo_opens = 0, book_opens = 0,
         concierge_impressions = 0, concierge_clicks = 0,
         inquiries = 0, paid_bookings = 0,
         countries = '{}', devices = '{}', sources = '{}', intents = '{}', surfaces = '{}',
         missed_matches = '{}',
         computed_at = NOW()
       WHERE date BETWEEN $1::date AND $2::date`,
      [from, to],
    );

    // Defensive: drop any bucket without a photographer (e.g. a future
    // query joining a nullable photographer_id) instead of failing the
    // whole transaction on the NOT NULL constraint.
    const entries = [...acc.entries()].filter(([k]) => {
      const key = keys.get(k);
      return Boolean(key?.photographerId && key.day);
    });
    if (entries.length > 0) {
      const ks = entries.map(([k]) => keys.get(k)!);
      const vs = entries.map(([, v]) => v);
      await client.query(
        `INSERT INTO photographer_daily_stats (
           photographer_id, date, profile_views, unique_visitors, returning_visitors,
           card_impressions, card_clicks, photo_opens, book_opens,
           concierge_impressions, concierge_clicks, inquiries, paid_bookings,
           countries, devices, sources, intents, surfaces, missed_matches, computed_at)
         SELECT * , NOW() FROM UNNEST(
           $1::uuid[], $2::date[], $3::int[], $4::int[], $5::int[],
           $6::int[], $7::int[], $8::int[], $9::int[],
           $10::int[], $11::int[], $12::int[], $13::int[],
           $14::jsonb[], $15::jsonb[], $16::jsonb[], $17::jsonb[], $18::jsonb[], $19::jsonb[])
         ON CONFLICT (photographer_id, date) DO UPDATE SET
           profile_views = EXCLUDED.profile_views,
           unique_visitors = EXCLUDED.unique_visitors,
           returning_visitors = EXCLUDED.returning_visitors,
           card_impressions = EXCLUDED.card_impressions,
           card_clicks = EXCLUDED.card_clicks,
           photo_opens = EXCLUDED.photo_opens,
           book_opens = EXCLUDED.book_opens,
           concierge_impressions = EXCLUDED.concierge_impressions,
           concierge_clicks = EXCLUDED.concierge_clicks,
           inquiries = EXCLUDED.inquiries,
           paid_bookings = EXCLUDED.paid_bookings,
           countries = EXCLUDED.countries,
           devices = EXCLUDED.devices,
           sources = EXCLUDED.sources,
           intents = EXCLUDED.intents,
           surfaces = EXCLUDED.surfaces,
           missed_matches = EXCLUDED.missed_matches,
           computed_at = NOW()`,
        [
          ks.map((k) => k.photographerId),
          ks.map((k) => k.day),
          vs.map((v) => v.profile_views),
          vs.map((v) => v.unique_visitors),
          vs.map((v) => v.returning_visitors),
          vs.map((v) => v.card_impressions),
          vs.map((v) => v.card_clicks),
          vs.map((v) => v.photo_opens),
          vs.map((v) => v.book_opens),
          vs.map((v) => v.concierge_impressions),
          vs.map((v) => v.concierge_clicks),
          vs.map((v) => v.inquiries),
          vs.map((v) => v.paid_bookings),
          vs.map((v) => JSON.stringify(v.countries)),
          vs.map((v) => JSON.stringify(v.devices)),
          vs.map((v) => JSON.stringify(v.sources)),
          vs.map((v) => JSON.stringify(v.intents)),
          vs.map((v) => JSON.stringify(v.surfaces)),
          vs.map((v) => JSON.stringify(v.missed_matches)),
        ],
      );
    }
  });

  let eventsPruned = 0;
  if (prune) {
    const res = await query<{ count: string }>(
      `WITH del AS (
         DELETE FROM photographer_events
         WHERE occurred_at < NOW() - INTERVAL '${EVENTS_RETENTION_DAYS} days'
         RETURNING 1)
       SELECT COUNT(*)::text AS count FROM del`,
    );
    eventsPruned = parseInt(res[0]?.count || "0", 10);
    await query(
      `DELETE FROM concierge_exclusion_events WHERE occurred_at < NOW() - INTERVAL '${EVENTS_RETENTION_DAYS} days'`,
    ).catch(() => {});
  }

  return { from, to, dailyRowsUpserted: acc.size, photoRowsUpserted, eventsPruned };
}

/**
 * Pull Google Search Console impressions/clicks/position for every
 * photographer profile URL (all locale variants summed) and upsert the
 * gsc_* columns. Dates are as GSC reports them; data lags ~2-3 days.
 * Uses the same service-account credentials as the digest cron.
 */
export async function pullGscProfileStats(from: string, to: string): Promise<{ rows: number; days: number }> {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");

  const { google } = await import("googleapis");
  const fs = await import("fs");
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./google-credentials.json";
  const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  // Paginate: GSC caps each response at rowLimit; long backfill ranges
  // (months × profiles × locale URLs) can exceed one page.
  const PAGE_SIZE = 25000;
  const rows: { keys?: string[] | null; impressions?: number | null; clicks?: number | null; position?: number | null }[] = [];
  for (let startRow = 0; ; startRow += PAGE_SIZE) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: process.env.GSC_SITE_URL || "https://photoportugal.com",
      requestBody: {
        startDate: from,
        endDate: to,
        dimensions: ["date", "page"],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: "page",
                operator: "includingRegex",
                expression: `/${PROFILE_SEGMENTS}/[a-z0-9-]+/?$`,
              },
            ],
          },
        ],
        rowLimit: PAGE_SIZE,
        startRow,
      },
    });
    const page = res.data.rows || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (rows.length === 0) return { rows: 0, days: 0 };

  // slug → per-date sums (locale variants of the same profile merge here)
  const byKey = new Map<string, { slug: string; date: string; impressions: number; clicks: number; posWeighted: number }>();
  const slugRe = new RegExp(PROFILE_PATH_RE);
  for (const row of rows) {
    const [date, page] = row.keys || [];
    if (!date || !page) continue;
    let path: string;
    try {
      path = new URL(page).pathname;
    } catch {
      continue;
    }
    const m = path.match(slugRe);
    if (!m) continue;
    const slug = m[1];
    const impressions = row.impressions || 0;
    const k = `${slug}|${date}`;
    const cur = byKey.get(k) || { slug, date, impressions: 0, clicks: 0, posWeighted: 0 };
    cur.impressions += impressions;
    cur.clicks += row.clicks || 0;
    cur.posWeighted += (row.position || 0) * impressions;
    byKey.set(k, cur);
  }
  if (byKey.size === 0) return { rows: 0, days: 0 };

  const slugs = [...new Set([...byKey.values()].map((v) => v.slug))];
  const photographers = await query<{ id: string; slug: string }>(
    "SELECT id, slug FROM photographer_profiles WHERE slug = ANY($1)",
    [slugs],
  );
  const idBySlug = new Map(photographers.map((p) => [p.slug, p.id]));

  const upserts = [...byKey.values()].filter((v) => idBySlug.has(v.slug));
  if (upserts.length === 0) return { rows: 0, days: 0 };

  await query(
    `INSERT INTO photographer_daily_stats (photographer_id, date, gsc_impressions, gsc_clicks, gsc_position)
     SELECT * FROM UNNEST($1::uuid[], $2::date[], $3::int[], $4::int[], $5::real[])
     ON CONFLICT (photographer_id, date) DO UPDATE SET
       gsc_impressions = EXCLUDED.gsc_impressions,
       gsc_clicks = EXCLUDED.gsc_clicks,
       gsc_position = EXCLUDED.gsc_position,
       computed_at = NOW()`,
    [
      upserts.map((v) => idBySlug.get(v.slug)),
      upserts.map((v) => v.date),
      upserts.map((v) => v.impressions),
      upserts.map((v) => v.clicks),
      upserts.map((v) => (v.impressions > 0 ? v.posWeighted / v.impressions : null)),
    ],
  );

  return { rows: upserts.length, days: new Set(upserts.map((v) => v.date)).size };
}
