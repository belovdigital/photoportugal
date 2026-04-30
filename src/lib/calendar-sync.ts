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
  });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  if (!body.includes("BEGIN:VCALENDAR")) throw new Error("Response is not a valid iCal feed");

  const horizonStart = new Date();
  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + SYNC_WINDOW_MONTHS);

  const slots: BusySlot[] = [];

  // Outer try/catch as last-ditch defense. node-ical 0.26 has internals
  // that throw `s.BigInt is not a function` during rrule expansion on
  // certain Apple iCloud feeds when bundled by Next.js webpack — and
  // sometimes the throw is async-tinted enough to slip past finer-grained
  // try/catches. If the library blows up entirely, fall back to a regex
  // parser that handles non-recurring VEVENTs (covers the vast majority
  // of personal calendar entries — birthdays/holidays/single bookings).
  try {
    const ical = await import("node-ical");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = ical.sync.parseICS(body) as Record<string, unknown>;
    } catch (parseErr) {
      console.warn("[calendar-sync] parseICS error, trying regex fallback:", parseErr);
    }

    for (const key of Object.keys(parsed)) {
      try {
        const ev = parsed[key] as {
          type?: string;
          transparency?: string;
          start?: Date;
          end?: Date;
          uid?: string;
          rrule?: { between: (start: Date, end: Date, inc: boolean) => Date[] };
          exdate?: Record<string, Date>;
        };
        if (!ev || ev.type !== "VEVENT") continue;
        const transp = ev.transparency;
        if (typeof transp === "string" && transp.toUpperCase() === "TRANSPARENT") continue;

        const baseStart = ev.start instanceof Date ? ev.start : null;
        const baseEnd = ev.end instanceof Date ? ev.end : null;
        if (!baseStart || !baseEnd) continue;

        if (ev.rrule) {
          const durationMs = baseEnd.getTime() - baseStart.getTime();
          const between = ev.rrule.between(horizonStart, horizonEnd, true);
          const exdates = ev.exdate;
          for (const occStart of between) {
            if (exdates) {
              const stamp = occStart.toISOString().slice(0, 10);
              if (Object.values(exdates).some((d) => d.toISOString().slice(0, 10) === stamp)) continue;
            }
            const occEnd = new Date(occStart.getTime() + durationMs);
            slots.push({ starts_at: occStart, ends_at: occEnd, source_uid: `${ev.uid || key}@${occStart.toISOString()}` });
          }
        } else {
          if (baseEnd <= horizonStart || baseStart >= horizonEnd) continue;
          slots.push({ starts_at: baseStart, ends_at: baseEnd, source_uid: ev.uid || key });
        }
      } catch (eventErr) {
        console.warn("[calendar-sync] skipping bad iCal event:", key, eventErr);
      }
    }
  } catch (libErr) {
    console.warn("[calendar-sync] node-ical blew up entirely, using regex fallback:", libErr);
  }

  // Regex fallback for non-recurring events — picks up plain DTSTART /
  // DTEND inside VEVENT blocks. Won't expand RRULE (without rrule lib
  // we can't), but handles 90% of typical personal-calendar entries.
  // Only kicks in when the library produced zero slots.
  if (slots.length === 0) {
    const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = veventRe.exec(body)) !== null) {
      const block = match[1];
      const dtStart = block.match(/DTSTART(?:;[^:]*)?:(\d{8}T\d{6}Z?|\d{8})/);
      const dtEnd = block.match(/DTEND(?:;[^:]*)?:(\d{8}T\d{6}Z?|\d{8})/);
      const transp = block.match(/TRANSP:(\w+)/);
      const uid = block.match(/UID:([^\r\n]+)/);
      const hasRrule = /RRULE:/.test(block);
      if (hasRrule) continue; // can't expand without the lib
      if (transp && transp[1].toUpperCase() === "TRANSPARENT") continue;
      if (!dtStart || !dtEnd) continue;
      const start = parseIcalDate(dtStart[1]);
      const end = parseIcalDate(dtEnd[1]);
      if (!start || !end) continue;
      if (end <= horizonStart || start >= horizonEnd) continue;
      slots.push({ starts_at: start, ends_at: end, source_uid: uid?.[1].trim() || `regex-${i++}` });
    }
  }

  return slots;
}

function parseIcalDate(s: string): Date | null {
  // Handles "20260501T143000Z", "20260501T143000", "20260501" forms.
  if (/^\d{8}$/.test(s)) {
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se, z] = m;
  if (z === "Z") return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
  // Floating local time — assume Lisbon for our purposes.
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}+00:00`);
}


/**
 * Refresh a Google access token using the stored refresh token. Persists
 * the new access token + expiry on the connection row. Returns the fresh
 * access token for immediate use.
 *
 * Google access tokens are valid for ~1 hour; refresh tokens never expire
 * unless the user revokes them or the app is unused for 6 months. So in
 * practice we refresh on demand whenever the cached token is within 60s
 * of expiry.
 */
async function refreshGoogleAccessToken(connectionId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`token refresh failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await queryOne(
    "UPDATE calendar_connections SET google_access_token = $1, google_access_token_expires_at = $2, updated_at = NOW() WHERE id = $3 RETURNING id",
    [data.access_token, expiresAt, connectionId]
  );
  return data.access_token;
}

async function getValidGoogleAccessToken(conn: ConnectionRow): Promise<string> {
  if (!conn.google_refresh_token) throw new Error("missing refresh token");
  const expiresAt = conn.google_access_token_expires_at ? new Date(conn.google_access_token_expires_at) : null;
  // Refresh if missing, expired, or within 60s of expiring.
  if (!conn.google_access_token || !expiresAt || expiresAt.getTime() - Date.now() < 60_000) {
    return refreshGoogleAccessToken(conn.id, conn.google_refresh_token);
  }
  return conn.google_access_token;
}

/**
 * List the calendars on a Google account so the photographer can pick
 * which ones count as "busy". `primary` is the user's main calendar
 * (always present). Secondary ones are personal calendars they created
 * plus any shared calendars they've subscribed to.
 */
export async function listGoogleCalendars(connection: ConnectionRow): Promise<{ id: string; summary: string; primary: boolean; selected: boolean }[]> {
  const accessToken = await getValidGoogleAccessToken(connection);
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 403 here almost always means the token was issued without
    // calendar.readonly — the photographer skipped the Calendar checkbox
    // on the OAuth consent screen. Tell them in plain English so they
    // know to reconnect with Calendar permission ticked.
    if (res.status === 403) {
      throw new Error("Google didn't grant Calendar permission. Click Disconnect, then Connect Google Calendar again and make sure the \"See and download any calendar\" box stays ticked.");
    }
    throw new Error(`calendarList failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json() as { items: { id: string; summary: string; primary?: boolean }[] };
  const selectedSet = new Set(connection.selected_calendar_ids || []);
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    selected: selectedSet.has(c.id) || (selectedSet.has("primary") && !!c.primary),
  }));
}

/**
 * Query Google's freeBusy endpoint for the photographer's selected
 * calendars and return aggregated busy slots within our sync window.
 *
 * Google caps a single freeBusy call at ~3 months between timeMin and
 * timeMax (`timeRangeTooLong` past that), so we chunk the 12-month sync
 * window into 30-day segments and merge results client-side. Each chunk
 * is one HTTP call; sequential to keep load on Google low — 12 calls
 * total finish in a few seconds.
 *
 * If the photographer ticked "primary", we resolve it to the actual
 * primary calendar id since `freeBusy` won't accept the literal string
 * "primary" reliably across all account types.
 */
async function fetchGoogleBusySlots(connection: ConnectionRow): Promise<BusySlot[]> {
  const accessToken = await getValidGoogleAccessToken(connection);

  // Resolve calendar ids — handle the "primary" pseudo-id by listing.
  const ids = (connection.selected_calendar_ids && connection.selected_calendar_ids.length > 0)
    ? connection.selected_calendar_ids
    : ["primary"];
  let resolvedIds = ids;
  if (ids.includes("primary")) {
    const list = await listGoogleCalendars(connection);
    const primaryCal = list.find((c) => c.primary);
    if (primaryCal) {
      resolvedIds = ids.flatMap((id) => id === "primary" ? [primaryCal.id] : [id]);
    }
  }

  const horizonStart = new Date();
  const horizonEnd = new Date();
  horizonEnd.setMonth(horizonEnd.getMonth() + SYNC_WINDOW_MONTHS);

  const CHUNK_DAYS = 30;
  const chunks: { start: Date; end: Date }[] = [];
  for (let cur = new Date(horizonStart); cur < horizonEnd; ) {
    const next = new Date(cur.getTime() + CHUNK_DAYS * 24 * 60 * 60 * 1000);
    const chunkEnd = next > horizonEnd ? horizonEnd : next;
    chunks.push({ start: new Date(cur), end: new Date(chunkEnd) });
    cur = next;
  }

  const slots: BusySlot[] = [];
  // De-dup across chunk boundaries: if an event spans a chunk boundary,
  // it'll appear in both chunks. Keying by `${cal}@${start}` collapses
  // those into one slot.
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: chunk.start.toISOString(),
        timeMax: chunk.end.toISOString(),
        items: resolvedIds.map((id) => ({ id })),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 403) {
        throw new Error("Google didn't grant Calendar permission. Click Disconnect, then Connect Google Calendar again and make sure the \"See and download any calendar\" box stays ticked.");
      }
      throw new Error(`freeBusy failed: ${res.status} ${txt.slice(0, 200)}`);
    }
    const data = await res.json() as {
      calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
    };

    for (const calId of resolvedIds) {
      const cal = data.calendars[calId];
      if (cal?.errors?.length) {
        console.warn(`[calendar-sync] freeBusy error for ${calId}:`, cal.errors);
        continue;
      }
      if (!cal?.busy) continue;
      for (const b of cal.busy) {
        const key = `${calId}@${b.start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        slots.push({
          starts_at: new Date(b.start),
          ends_at: new Date(b.end),
          source_uid: key,
        });
      }
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
      slots = await fetchGoogleBusySlots(connection);
    } else {
      throw new Error(`unknown connection type: ${connection.type}`);
    }
  } catch (err) {
    // Hard failure (network, auth, completely unparseable feed) — surface
    // to the photographer. Soft per-event errors are caught inside the
    // fetchers, so reaching this branch genuinely means the sync didn't
    // produce anything we can use.
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
