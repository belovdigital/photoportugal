import { query, queryOne } from "@/lib/db";

// Window for which we cache busy slots. Anything beyond is rebuilt on demand.
// 12 months is enough for a wedding photographer's calendar without bloating
// the table — most booking attempts fall within ~3 months.
const SYNC_WINDOW_MONTHS = 12;

export type ConnectionRow = {
  id: string;
  photographer_id: string;
  type: "google" | "ical";
  display_name: string;
  google_email: string | null;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_access_token_expires_at: string | null;
  selected_calendar_ids: string[] | null;
  ical_url: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  last_sync_event_count: number | null;
};

export type BusySlot = {
  starts_at: Date;
  ends_at: Date;
  source_uid: string | null;
};

/**
 * Fetch + parse a webcal:// or https:// iCal feed and return all busy
 * windows in [now, now + 12mo). Recurring events are expanded by node-ical
 * (rrule lib under the hood).
 *
 * The same iCal feed often contains the photographer's full life — birthdays,
 * holidays, kids' school events. We DO honour all events as "busy" in v1
 * (i.e. you can't shoot during your kid's birthday). The photographer
 * controls what's in their calendar; if they want shoots possible during
 * unimportant events they can move those to a separate calendar and not
 * subscribe to it via Photo Portugal.
 *
 * `webcal://` URLs are normalized to `https://` since fetch doesn't speak
 * webcal — the protocol is just iCal calendar's "subscribe" hint to the
 * OS, the underlying fetch is plain HTTPS.
 */
export async function fetchIcalBusySlots(icalUrl: string): Promise<BusySlot[]> {
  const url = icalUrl.replace(/^webcal:\/\//i, "https://");
  const res = await fetch(url, {
    headers: { "User-Agent": "PhotoPortugal-CalendarSync/1.0" },
    // Some calendar servers (e.g. iCloud) return 200 only with text/calendar accept.
    // Default fetch sends */*, which works with Google/Apple. Keep it simple.
  });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  if (!body.includes("BEGIN:VCALENDAR")) throw new Error("Response is not a valid iCal feed");

  // Lazy-load node-ical so the bundle of API routes that DON'T touch
  // calendar sync stays smaller.
  const ical = await import("node-ical");
  const parsed = ical.sync.parseICS(body);

  const horizonStart = new Date();
  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + SYNC_WINDOW_MONTHS);

  const slots: BusySlot[] = [];

  for (const key of Object.keys(parsed)) {
    const ev = parsed[key];
    if (!ev || ev.type !== "VEVENT") continue;

    // Skip "transparent" events — the iCal way of marking a calendar entry
    // as informational/free (e.g. "FYI: dad's flight"). If the photographer
    // marks the event Free, we honour that.
    const transp = (ev as { transparency?: string }).transparency;
    if (typeof transp === "string" && transp.toUpperCase() === "TRANSPARENT") continue;

    const baseStart = ev.start instanceof Date ? ev.start : null;
    const baseEnd = ev.end instanceof Date ? ev.end : null;
    if (!baseStart || !baseEnd) continue;

    if (ev.rrule) {
      // Recurring event — expand all instances within our window. The dates
      // returned by rrule.between() are anchored to the event's start; we
      // recompute end by preserving the original duration.
      const durationMs = baseEnd.getTime() - baseStart.getTime();
      const between = ev.rrule.between(horizonStart, horizonEnd, true);
      const exdates: Record<string, Date> | undefined = (ev as { exdate?: Record<string, Date> }).exdate;
      for (const occStart of between) {
        // Skip cancelled occurrences (EXDATE).
        if (exdates) {
          const stamp = occStart.toISOString().slice(0, 10);
          if (Object.values(exdates).some((d) => d.toISOString().slice(0, 10) === stamp)) continue;
        }
        const occEnd = new Date(occStart.getTime() + durationMs);
        slots.push({
          starts_at: occStart,
          ends_at: occEnd,
          source_uid: `${ev.uid || key}@${occStart.toISOString()}`,
        });
      }
    } else {
      // Single event — only include if it falls inside the window.
      if (baseEnd <= horizonStart || baseStart >= horizonEnd) continue;
      slots.push({
        starts_at: baseStart,
        ends_at: baseEnd,
        source_uid: ev.uid || key,
      });
    }
  }

  return slots;
}

/**
 * Refresh a single connection's busy slots: fetch upstream, replace cached
 * rows for this connection. Updates last_synced_at + last_sync_error so the
 * dashboard can surface "synced 3 min ago" or "failed: invalid URL".
 *
 * Wraps in a transaction so a partial replace can't leave the cache empty
 * while the new rows aren't yet inserted — booking conflicts would falsely
 * pass during that window.
 */
export async function syncConnection(connection: ConnectionRow): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  let slots: BusySlot[];
  try {
    if (connection.type === "ical") {
      if (!connection.ical_url) throw new Error("missing ical_url");
      slots = await fetchIcalBusySlots(connection.ical_url);
    } else if (connection.type === "google") {
      // Implemented in a follow-up alongside the OAuth flow.
      throw new Error("google sync not yet implemented");
    } else {
      throw new Error(`unknown connection type: ${connection.type}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await queryOne(
      "UPDATE calendar_connections SET last_sync_error = $1, last_synced_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING id",
      [msg.slice(0, 500), connection.id]
    );
    return { ok: false, error: msg };
  }

  // Replace cached slots for this connection in a single transaction.
  // (queryOne uses the shared pool — fine for a quick DELETE + bulk INSERT.)
  await query("DELETE FROM calendar_busy_slots WHERE connection_id = $1", [connection.id]);
  if (slots.length > 0) {
    // Bulk insert — pg's parameter limit is high enough for typical calendars.
    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const slot of slots) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(connection.photographer_id, connection.id, slot.starts_at, slot.ends_at, slot.source_uid);
    }
    await query(
      `INSERT INTO calendar_busy_slots (photographer_id, connection_id, starts_at, ends_at, source_uid) VALUES ${values.join(", ")}`,
      params
    );
  }

  await queryOne(
    "UPDATE calendar_connections SET last_synced_at = NOW(), last_sync_error = NULL, last_sync_event_count = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
    [slots.length, connection.id]
  );

  return { ok: true, count: slots.length };
}

/**
 * Returns true if the photographer has any cached busy slot that overlaps
 * [start, end). Used at booking-time to reject the slot before charging.
 *
 * Half-open interval semantics: an event ending exactly at `start` does
 * NOT count as a conflict, and an event starting exactly at `end` doesn't
 * either. Matches how meeting tools render adjacent slots.
 */
export async function hasBusyOverlap(photographerId: string, start: Date, end: Date): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM calendar_busy_slots
        WHERE photographer_id = $1
          AND starts_at < $3
          AND ends_at > $2
     ) AS exists`,
    [photographerId, start, end]
  );
  return !!row?.exists;
}
