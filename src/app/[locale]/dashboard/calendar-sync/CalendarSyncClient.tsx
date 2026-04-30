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

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Add buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {showAdd ? "Cancel" : "+ Add iCal calendar"}
        </button>
        <button
          disabled
          title="Coming soon — Google OAuth verification in progress"
          className="rounded-lg border border-warm-200 bg-white px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
        >
          Connect Google Calendar (soon)
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
              <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
