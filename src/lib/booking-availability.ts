import { query, queryOne } from "@/lib/db";
import {
  addMinutes,
  type BusyWindow,
  internalBookingWindow,
} from "@/lib/booking-time-windows";

export {
  hasAvailableBookingStart,
  lisbonLocalMinutesToUtc,
  type BusyWindow,
} from "@/lib/booking-time-windows";

const LISBON_TZ = "Europe/Lisbon";
const DEFAULT_BUFFER_MINUTES = 60;

let cachedHasBufferColumn: boolean | null = null;

export async function photographerCalendarBufferColumnExists(): Promise<boolean> {
  if (cachedHasBufferColumn !== null) return cachedHasBufferColumn;

  try {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'photographer_profiles'
           AND column_name = 'calendar_buffer_minutes'
       ) as exists`
    );
    cachedHasBufferColumn = !!row?.exists;
  } catch {
    cachedHasBufferColumn = false;
  }

  return cachedHasBufferColumn;
}

export async function getPhotographerCalendarBufferMinutes(photographerId: string): Promise<number> {
  if (!(await photographerCalendarBufferColumnExists())) return DEFAULT_BUFFER_MINUTES;

  const row = await queryOne<{ calendar_buffer_minutes: number }>(
    `SELECT COALESCE(calendar_buffer_minutes, $2) AS calendar_buffer_minutes
       FROM photographer_profiles
      WHERE id = $1`,
    [photographerId, DEFAULT_BUFFER_MINUTES]
  );

  return normalizeBufferMinutes(row?.calendar_buffer_minutes ?? DEFAULT_BUFFER_MINUTES);
}

export function normalizeBufferMinutes(value: unknown): number {
  const minutes = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(minutes)) return DEFAULT_BUFFER_MINUTES;
  return Math.max(0, Math.min(24 * 60, Math.round(minutes)));
}

function bufferedWindow(start: Date, end: Date, bufferMinutes: number, source: BusyWindow["source"]): BusyWindow {
  return {
    starts_at: addMinutes(start, -bufferMinutes).toISOString(),
    ends_at: addMinutes(end, bufferMinutes).toISOString(),
    source,
  };
}

export async function getBufferedBusyWindows(
  photographerId: string,
  rangeStart: Date,
  rangeEnd: Date,
  bufferMinutes: number,
  excludeBookingId?: string
): Promise<BusyWindow[]> {
  const calendarRows = await query<{ starts_at: string; ends_at: string }>(
    `SELECT to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS starts_at,
            to_char(ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS ends_at
       FROM calendar_busy_slots
      WHERE photographer_id = $1
        AND starts_at < $3
        AND ends_at > $2
      ORDER BY starts_at`,
    [photographerId, addMinutes(rangeStart, -bufferMinutes), addMinutes(rangeEnd, bufferMinutes)]
  );

  const bookingRows = await query<{
    id: string;
    shoot_date: string;
    shoot_time: string | null;
    duration_minutes: number | null;
  }>(
    `SELECT b.id, b.shoot_date::text, b.shoot_time, COALESCE(p.duration_minutes, 120) AS duration_minutes
       FROM bookings b
       LEFT JOIN packages p ON p.id = b.package_id
      WHERE b.photographer_id = $1
        AND b.shoot_date IS NOT NULL
        AND b.status IN ('pending', 'confirmed', 'completed', 'delivered')
        AND ($4::uuid IS NULL OR b.id <> $4::uuid)
        AND b.shoot_date >= (($2::timestamptz AT TIME ZONE $5)::date - INTERVAL '1 day')::date
        AND b.shoot_date <= (($3::timestamptz AT TIME ZONE $5)::date + INTERVAL '1 day')::date`,
    [photographerId, rangeStart, rangeEnd, excludeBookingId || null, LISBON_TZ]
  );

  const windows = [
    ...calendarRows.map((row) => bufferedWindow(new Date(row.starts_at), new Date(row.ends_at), bufferMinutes, "calendar")),
    ...bookingRows.map((row) => {
      const window = internalBookingWindow(row.shoot_date, row.shoot_time, row.duration_minutes || 120);
      return bufferedWindow(window.start, window.end, bufferMinutes, "booking");
    }),
  ];

  return windows
    .filter((window) => new Date(window.starts_at) < rangeEnd && new Date(window.ends_at) > rangeStart)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
