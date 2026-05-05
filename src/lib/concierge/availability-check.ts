// Check whether a list of photographers is available on a given date
// (or date range). Used by the concierge to surface availability badges
// on match cards instead of letting the visitor click through and
// discover they can't book.
//
// Reuses the same data the booking flow already trusts:
//   - photographer_unavailability (manual blocks)
//   - bookings with status in ('confirmed','completed','delivered')
//   - synced calendar busy windows via getBufferedBusyWindows()
//
// We deliberately do NOT include 'pending' bookings in the busy set —
// pending ≠ confirmed and a concierge match shouldn't be blocked by
// someone who hasn't paid yet.

import { query } from "@/lib/db";
import {
  getBufferedBusyWindows,
  getPhotographerCalendarBufferMinutes,
  lisbonLocalMinutesToUtc,
} from "@/lib/booking-availability";

export interface AvailabilityResult {
  /** ISO date the visitor mentioned (YYYY-MM-DD). */
  date: string;
  available: boolean;
  /** Short label for UI: "Available Jun 15" / "Busy Jun 15" / "Tentative". */
  label: string;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatLabel(dateIso: string, available: boolean): string {
  try {
    const d = new Date(dateIso + "T12:00:00Z");
    const dayMonth = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return available ? `Available ${dayMonth}` : `Busy ${dayMonth}`;
  } catch {
    return available ? "Available" : "Busy";
  }
}

/** Returns a map: photographerId → { available, label }. Returns null
 *  for photographers we couldn't check (DB error etc.) so the UI can
 *  hide the badge instead of showing wrong info. */
export async function checkPhotographersAvailability(
  photographerIds: string[],
  dateIso: string
): Promise<Map<string, AvailabilityResult>> {
  const out = new Map<string, AvailabilityResult>();
  if (!ISO_RE.test(dateIso) || photographerIds.length === 0) return out;

  // Manual unavailability + confirmed bookings spanning that date
  let blocked: Set<string>;
  try {
    const rows = await query<{ photographer_id: string }>(
      `SELECT DISTINCT photographer_id FROM (
         SELECT photographer_id
           FROM photographer_unavailability
          WHERE photographer_id = ANY($1::uuid[])
            AND $2::date BETWEEN date_from AND date_to
         UNION ALL
         SELECT photographer_id
           FROM bookings
          WHERE photographer_id = ANY($1::uuid[])
            AND status IN ('confirmed','completed','delivered')
            AND shoot_date = $2::date
       ) u`,
      [photographerIds, dateIso]
    );
    blocked = new Set(rows.map((r) => r.photographer_id));
  } catch (err) {
    console.error("[concierge/availability] db error:", err);
    return out;
  }

  // Calendar busy windows (per-photographer call — small N, fine).
  // Skip if photographer is already in `blocked` for cheapness.
  for (const id of photographerIds) {
    let available = !blocked.has(id);
    if (available) {
      try {
        const buffer = await getPhotographerCalendarBufferMinutes(id);
        const rangeStart = lisbonLocalMinutesToUtc(dateIso, 0);
        const rangeEnd = lisbonLocalMinutesToUtc(dateIso, 24 * 60);
        const busy = await getBufferedBusyWindows(id, rangeStart, rangeEnd, buffer);
        if (busy && busy.length > 0) available = false;
      } catch {
        // If calendar lookup fails, fall back to manual+bookings answer.
      }
    }
    out.set(id, { date: dateIso, available, label: formatLabel(dateIso, available) });
  }
  return out;
}
