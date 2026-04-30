"use client";

import { useEffect, useState } from "react";

type Connection = {
  id: string;
  type: "google" | "ical";
  display_name: string;
  google_email: string | null;
  selected_calendar_ids: string[] | null;
  ical_url: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  last_sync_event_count: number | null;
};

type GoogleCal = { id: string; summary: string; primary: boolean; selected: boolean };

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CalendarSyncClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adding, setAdding] = useState(false);

  // Per-row sync busy flag
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  // Google calendar selection: which connection's manage panel is open,
  // its calendar list, and which ids are currently ticked.
  const [managingId, setManagingId] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCal[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [calendarsSaving, setCalendarsSaving] = useState(false);

  // Banner from OAuth callback: "?connected=google&email=..." or "?error=..."
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const err = url.searchParams.get("error");
    const email = url.searchParams.get("email");
    if (connected === "google") {
      setBanner({ kind: "ok", text: `Connected Google Calendar${email ? ` (${email})` : ""}.` });
    } else if (err) {
      const friendly: Record<string, string> = {
        calendar_scope_not_granted: "You skipped the Calendar checkbox on Google's consent screen. Click \"Connect Google Calendar\" again and make sure \"See and download any calendar you can access\" stays ticked.",
        no_refresh_token: "Google didn't issue a refresh token. Disconnect this Google account in your Google Account settings (Security → Third-party apps), then try connecting again.",
        access_denied: "You declined the Google permission. No worries — click Connect again whenever you're ready.",
      };
      setBanner({ kind: "err", text: friendly[err] || `Google connection failed: ${err}` });
    }
    if (connected || err) {
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Defensive .json() — if a backend route crashes Next renders an HTML
  // error page, which makes the raw `await res.json()` throw the cryptic
  // "Unexpected token '<'" error in the UI. Fall back to text + status so
  // the user sees something actionable.
  async function safeJson(res: Response): Promise<{ ok: boolean; data: { error?: string; [k: string]: unknown } }> {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, data };
    }
    const txt = await res.text();
    return {
      ok: res.ok,
      data: { error: `${res.status} ${res.statusText}${txt ? ` — ${txt.slice(0, 200).replace(/<[^>]+>/g, "").trim()}` : ""}` },
    };
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/calendar");
      const { ok, data } = await safeJson(res);
      if (!ok) throw new Error((data.error as string) || "Failed to load");
      setConnections((data.connections as Connection[]) || []);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addIcal(e: React.FormEvent) {
    e.preventDefault();
    if (!icalUrl.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ical",
          ical_url: icalUrl.trim(),
          display_name: displayName.trim() || "iCal calendar",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      setIcalUrl("");
      setDisplayName("");
      setShowAdd(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  async function syncNow(id: string) {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      await fetch(`/api/dashboard/calendar/${id}`, { method: "POST" });
      await load();
    } finally {
      setSyncing((s) => ({ ...s, [id]: false }));
    }
  }

  async function remove(id: string) {
    if (!confirm("Disconnect this calendar? Future bookings won't check it for conflicts.")) return;
    await fetch(`/api/dashboard/calendar/${id}`, { method: "DELETE" });
    await load();
  }

  async function openManage(id: string) {
    setManagingId(id);
    setCalendars([]);
    setCalendarsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/calendar/${id}/calendars`);
      const { ok, data } = await safeJson(res);
      if (!ok) throw new Error((data.error as string) || "Failed to list calendars");
      setCalendars((data.calendars as GoogleCal[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to list calendars");
      setManagingId(null);
    } finally {
      setCalendarsLoading(false);
    }
  }

  function toggleCalendar(id: string) {
    setCalendars((prev) => prev.map((c) => c.id === id ? { ...c, selected: !c.selected } : c));
  }

  async function saveCalendarSelection() {
    if (!managingId) return;
    setCalendarsSaving(true);
    try {
      const ids = calendars.filter((c) => c.selected).map((c) => c.id);
      await fetch(`/api/dashboard/calendar/${managingId}/calendars`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_calendar_ids: ids }),
      });
      setManagingId(null);
      await load();
    } finally {
      setCalendarsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          banner.kind === "ok"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {banner.text}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Recommendation about which calendars to connect */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Tip:</strong>&nbsp;connect only calendars you actually use for work. Things like personal birthdays,
        kids&apos; school events, or holidays will block clients from booking those days even if you&apos;d be
        happy to shoot. Many photographers keep a dedicated &quot;Work&quot; calendar for this reason.
      </div>

      {/* Add buttons row */}
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/calendar/google/connect"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connect Google Calendar
        </a>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-warm-50 inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {showAdd ? "Cancel" : "Apple Calendar"}
        </button>
      </div>

      {/* Apple Calendar add form */}
      {showAdd && (
        <form onSubmit={addIcal} className="rounded-xl border border-warm-200 bg-warm-50 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Connect Apple Calendar</h3>
            <p className="mt-1 text-sm text-gray-600">
              Apple doesn&apos;t offer one-click OAuth like Google does, so we connect via a public
              calendar link. Takes about a minute.
            </p>
          </div>

          <div className="rounded-lg bg-white border border-warm-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">How to get your Apple Calendar link <span className="text-xs font-normal text-gray-400">(on your Mac)</span></p>
            <ol className="space-y-1.5 text-sm text-gray-700 list-decimal list-inside">
              <li>Open the <strong>Calendar</strong> app.</li>
              <li>In the sidebar, <strong>right-click</strong> the calendar you want to share → <strong>Get Info</strong>.</li>
              <li>Tick <strong>Public Calendar</strong> → click <strong>OK</strong> to close the popup.</li>
              <li><strong>Right-click the same calendar again</strong> — now <strong>Copy URL</strong> will appear in the menu. Click it.</li>
              <li>Paste the URL below (starts with <code className="px-1 bg-warm-100 rounded">webcal://</code>) → <strong>Connect</strong>.</li>
            </ol>
            <p className="mt-3 text-xs text-gray-500">
              The &quot;Copy URL&quot; option only shows up after you close the Get Info popup — that part trips
              up most people. We only read busy time ranges, never event titles or details.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Calendar URL
            </label>
            <input
              type="text"
              required
              placeholder="webcal://p123-caldav.icloud.com/published/2/..."
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2.5 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Name <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="My Calendar"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2.5 text-sm"
              maxLength={80}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding || !icalUrl.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
            >
              {adding ? "Connecting…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setIcalUrl(""); setDisplayName(""); }}
              className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-warm-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Connections list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : connections.length === 0 ? (
        <div className="rounded-xl border border-warm-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">No calendars connected yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Add one above and any busy events from your personal calendar will block clients
            from booking those slots.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="rounded-xl border border-warm-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{c.display_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    c.type === "google" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {c.type === "google" ? "Google" : "iCal"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 break-all">
                  {c.type === "ical" ? c.ical_url : c.google_email}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {c.last_sync_error ? (
                    <span className="text-red-600">⚠ {c.last_sync_error}</span>
                  ) : (
                    <>
                      Synced {timeAgo(c.last_synced_at)}
                      {c.last_sync_event_count != null && (
                        <span className="text-gray-400"> · {c.last_sync_event_count} events tracked</span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {c.type === "google" && (
                  <button
                    onClick={() => openManage(c.id)}
                    className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-warm-50"
                  >
                    Pick calendars
                  </button>
                )}
                <button
                  onClick={() => syncNow(c.id)}
                  disabled={syncing[c.id]}
                  className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-warm-50 disabled:opacity-40"
                >
                  {syncing[c.id] ? "Syncing…" : "Sync now"}
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA back to the actual calendar view */}
      {!loading && (
        <div className="mt-2 rounded-xl border border-warm-200 bg-warm-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-900">See it in action</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Your actual schedule — bookings, deliveries, and busy days — lives on the Overview.
            </p>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            View my schedule →
          </a>
        </div>
      )}

      {/* Calendar selection modal-ish panel */}
      {managingId && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setManagingId(null); }}
        >
          <div className="bg-white rounded-xl max-w-md w-full p-5 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Pick calendars</h3>
            <p className="mt-1 text-xs text-gray-500">
              Tick the calendars whose busy times should block bookings on Photo Portugal.
              Untick any you want to ignore (e.g. holidays, kids&apos; school).
            </p>
            {calendarsLoading ? (
              <p className="mt-4 text-sm text-gray-500">Loading calendars…</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {calendars.map((cal) => (
                  <label key={cal.id} className="flex items-center gap-2 p-2 rounded hover:bg-warm-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cal.selected}
                      onChange={() => toggleCalendar(cal.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-900">{cal.summary}</span>
                    {cal.primary && (
                      <span className="text-[10px] font-bold uppercase text-gray-400">primary</span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setManagingId(null)}
                className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-warm-50"
              >
                Cancel
              </button>
              <button
                onClick={saveCalendarSelection}
                disabled={calendarsSaving || calendarsLoading}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {calendarsSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
