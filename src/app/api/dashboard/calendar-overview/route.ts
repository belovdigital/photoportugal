import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Photographer's own calendar feed for the dashboard widget.
 *
 * Returns three streams within the [from, to] date window:
 *   * shoots — confirmed/completed/delivered bookings on shoot_date.
 *   * deliveries — completed bookings whose delivery is due in this
 *     window (shoot_date + package.delivery_days), still un-shared.
 *   * blockedDates — union of manual unavailability ranges and synced
 *     calendar_busy_slots (collapsed to whole-day strings using the
 *     same 06:00-23:00 Lisbon window as the public availability API,
 *     so the photographer's view matches what clients see).
 */
export async function GET(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [user.id]
  );
  if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const today = new Date().toISOString().split("T")[0];
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

  const shoots = await query<{
    id: string;
    shoot_date: string;
    shoot_time: string | null;
    status: string;
    payment_status: string;
    total_price: number | null;
    client_name: string;
    package_name: string | null;
    duration_minutes: number | null;
    location_slug: string | null;
  }>(
    `SELECT b.id, b.shoot_date::text, b.shoot_time, b.status, b.payment_status, b.total_price,
            cu.name AS client_name, p.name AS package_name,
            COALESCE(p.duration_minutes, NULL) AS duration_minutes,
            b.location_slug
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
      WHERE b.photographer_id = $1
        AND b.shoot_date IS NOT NULL
        AND b.shoot_date >= $2::date
        AND b.shoot_date <= $3::date
        AND b.status IN ('confirmed', 'completed', 'delivered')
      ORDER BY b.shoot_date, b.shoot_time NULLS LAST`,
    [profile.id, from, to]
  );

  const deliveries = await query<{
    id: string;
    due_date: string;
    status: string;
    client_name: string;
    has_delivery: boolean;
  }>(
    `SELECT b.id,
            (b.shoot_date + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date::text AS due_date,
            b.status,
            cu.name AS client_name,
            (b.delivery_token IS NOT NULL) AS has_delivery
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
      WHERE b.photographer_id = $1
        AND b.status = 'completed'
        AND b.delivery_token IS NULL
        AND (b.shoot_date + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date >= $2::date
        AND (b.shoot_date + COALESCE(p.delivery_days, 7) * INTERVAL '1 day')::date <= $3::date
      ORDER BY due_date`,
    [profile.id, from, to]
  );

  const manualBlocks = await query<{ blocked_date: string; reason: string | null; source: string }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS blocked_date,
            pu.reason,
            'manual'::text AS source
       FROM photographer_unavailability pu,
            LATERAL generate_series(pu.date_from, pu.date_to, '1 day'::interval) AS d
      WHERE pu.photographer_id = $1
        AND pu.date_to >= $2::date
        AND pu.date_from <= $3::date`,
    [profile.id, from, to]
  );

  // Same 4-hour threshold as the public availability endpoint, so what
  // the photographer sees here matches what clients see on /book.
  const syncedBlocks = await query<{ blocked_date: string }>(
    `SELECT DISTINCT to_char(d, 'YYYY-MM-DD') AS blocked_date
       FROM calendar_busy_slots cbs,
            LATERAL generate_series(
              (cbs.starts_at AT TIME ZONE 'Europe/Lisbon')::date,
              (cbs.ends_at   AT TIME ZONE 'Europe/Lisbon')::date,
              '1 day'::interval
            ) AS d
      WHERE cbs.photographer_id = $1
        AND cbs.ends_at >= NOW()
        AND EXTRACT(EPOCH FROM (cbs.ends_at - cbs.starts_at)) >= 3 * 3600
        AND EXTRACT(HOUR FROM (cbs.starts_at AT TIME ZONE 'Europe/Lisbon')) < 23
        AND EXTRACT(HOUR FROM (cbs.ends_at   AT TIME ZONE 'Europe/Lisbon')) >= 6
        AND d::date >= $2::date
        AND d::date <= $3::date`,
    [profile.id, from, to]
  );

  // Merge manual + synced into one list keyed by date. Manual wins on
  // tie since it carries an explicit reason from the photographer.
  const byDate = new Map<string, { date: string; reason: string | null; source: "manual" | "synced" }>();
  for (const b of manualBlocks) {
    byDate.set(b.blocked_date, { date: b.blocked_date, reason: b.reason, source: "manual" });
  }
  for (const b of syncedBlocks) {
    if (!byDate.has(b.blocked_date)) {
      byDate.set(b.blocked_date, { date: b.blocked_date, reason: null, source: "synced" });
    }
  }
  const blockedDates = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ shoots, deliveries, blockedDates });
}
