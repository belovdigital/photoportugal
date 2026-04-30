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
      setBanner({ kind: "err", text: `Google connection failed: ${err}` });
    }
    if (connected || err) {
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/calendar");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setConnections(data.connections || []);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to list calendars");
      setCalendars(data.calendars || []);
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
          className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-warm-50"
        >
          {showAdd ? "Cancel" : "+ Add iCal URL"}
        </button>
      </div>

      {/* Add iCal form */}
      {showAdd && (
        <form onSubmit={addIcal} className="rounded-xl border border-warm-200 bg-warm-50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              iCal URL (or webcal://)
            </label>
            <input
              type="text"
              required
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics  or  webcal://p..."
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Apple Calendar: Calendar → right-click your calendar → Share → Public → copy URL.<br />
              Google Calendar: Settings → your calendar → Integrate → Secret address in iCal format.<br />
              Outlook: Settings → Calendar → Shared calendars → Publish → ICS link.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Display name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="My Apple Calendar"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
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
