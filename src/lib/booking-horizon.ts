import { query } from "@/lib/db";

/**
 * If a photographer has NO open day left in the current year — their
 * photographer_unavailability ranges cover today through Dec 31 — returns
 * the year of their first open day (e.g. 2027). Otherwise null.
 *
 * Used to flip the empty-calendar problem into a positive signal on the
 * profile: "Accepting bookings for 2027–2028" instead of a wall of
 * blocked dates (first case: Kate Belova, blocked 2026-06-12→2027-03-01).
 */
export async function bookingHorizonYear(photographerId: string): Promise<number | null> {
  const ranges = await query<{ date_from: string; date_to: string }>(
    `SELECT date_from::text, date_to::text FROM photographer_unavailability
     WHERE photographer_id = $1 AND date_to >= CURRENT_DATE
     ORDER BY date_from`,
    [photographerId]
  );
  if (ranges.length === 0) return null;

  // Walk a cursor from today through the (sorted, possibly overlapping)
  // blocked ranges. Wherever a range starts after the cursor there is a
  // free day — stop; otherwise jump to the day after the block.
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const r of ranges) {
    const from = new Date(`${r.date_from}T00:00:00`);
    const to = new Date(`${r.date_to}T00:00:00`);
    if (from.getTime() > cursor.getTime()) break;
    if (to.getTime() >= cursor.getTime()) {
      cursor = new Date(to.getTime() + 86_400_000);
    }
  }

  const nowYear = new Date().getFullYear();
  return cursor.getFullYear() > nowYear ? cursor.getFullYear() : null;
}
