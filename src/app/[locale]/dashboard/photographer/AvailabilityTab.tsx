"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import DatePicker from "@/components/ui/DatePicker";
import { CalendarSyncClient } from "@/app/[locale]/dashboard/calendar-sync/CalendarSyncClient";

interface UnavailabilityRange {
  id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  created_at: string;
}

function formatRange(from: string, to: string, locale: string) {
  const loc = ({pt:"pt-PT",de:"de-DE",es:"es-ES",fr:"fr-FR",en:"en-GB"} as Record<string,string>)[locale] || "en-GB";
  const f = new Date(from + "T12:00:00");
  const t = new Date(to + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const optsYear: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (f.getFullYear() !== t.getFullYear()) {
    return `${f.toLocaleDateString(loc, optsYear)} — ${t.toLocaleDateString(loc, optsYear)}`;
  }
  return `${f.toLocaleDateString(loc, opts)} — ${t.toLocaleDateString(loc, optsYear)}`;
}

function isPast(dateTo: string) {
  return dateTo < new Date().toISOString().split("T")[0];
}

export function AvailabilityTab() {
  const t = useTranslations("availability");
  const tSet = useTranslations("settings");
  const locale = useLocale();
  const [ranges, setRanges] = useState<UnavailabilityRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Booking-rules section — was previously in /dashboard/settings,
  // moved here so all "when can clients reach me" controls live in
  // one place. Loaded lazily; defaults to 0 (no restriction).
  const [minLeadTimeHours, setMinLeadTimeHours] = useState<number>(0);
  const [leadTimeLoaded, setLeadTimeLoaded] = useState(false);
  const [savingLeadTime, setSavingLeadTime] = useState(false);
  const [leadTimeMessage, setLeadTimeMessage] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/booking-settings")
      .then((r) => r.json())
      .then((data) => {
        setMinLeadTimeHours(data.minLeadTimeHours ?? 0);
        setLeadTimeLoaded(true);
      })
      .catch(() => setLeadTimeLoaded(true));
  }, []);

  async function saveLeadTime(hours: number) {
    setSavingLeadTime(true);
    setMinLeadTimeHours(hours);
    setLeadTimeMessage("");
    try {
      const res = await fetch("/api/dashboard/booking-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minLeadTimeHours: hours }),
      });
      if (res.ok) {
        setLeadTimeMessage(tSet("settingsSaved"));
        setTimeout(() => setLeadTimeMessage(""), 2000);
      } else {
        setLeadTimeMessage(tSet("failedToSave"));
      }
    } catch {
      setLeadTimeMessage(tSet("failedToSave"));
    }
    setSavingLeadTime(false);
  }
  const [showArchive, setShowArchive] = useState(false);

  async function fetchRanges() {
    const res = await fetch("/api/availability");
    if (res.ok) setRanges(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchRanges(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!dateFrom || !dateTo) { setError(t("selectBothDates")); return; }
    if (dateFrom > dateTo) { setError(t("startBeforeEnd")); return; }

    setSaving(true);
    setError("");
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date_from: dateFrom, date_to: dateTo, reason: reason || null }),
    });
    setSaving(false);

    if (res.ok) {
      setDateFrom("");
      setDateTo("");
      setReason("");
      fetchRanges();
    } else {
      try {
        const data = await res.json();
        setError(data.error || t("failedToSave"));
      } catch {
        setError(t("failedToSave"));
      }
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/availability", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchRanges();
  }

  const activeRanges = ranges.filter((r) => !isPast(r.date_to));
  const pastRanges = ranges.filter((r) => isPast(r.date_to));

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <p className="text-sm text-gray-500">
        {t("description")}
      </p>

      {/* Booking Rules — minimum advance notice. Sits at the top of
          Availability because it's the same intent (controlling when
          clients can reach you). 0 = no restriction. Updates auto-save
          on change; the green "saved" tick fades out after 2s. */}
      <div className="mt-6 rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">{tSet("bookingRules")}</h3>
        <p className="mt-1 text-xs text-gray-400">{tSet("bookingRulesDesc")}</p>
        <label htmlFor="min-lead-time" className="mt-4 block text-sm font-medium text-gray-900">
          {tSet("minLeadTimeLabel")}
        </label>
        <p className="mt-0.5 text-xs text-gray-400">{tSet("minLeadTimeDesc")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            id="min-lead-time"
            value={minLeadTimeHours}
            onChange={(e) => saveLeadTime(parseInt(e.target.value, 10))}
            disabled={!leadTimeLoaded || savingLeadTime}
            className="w-full max-w-sm rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 disabled:opacity-50"
          >
            <option value={0}>{tSet("minLeadTimeNone")}</option>
            <option value={12}>{tSet("minLeadTime12h")}</option>
            <option value={24}>{tSet("minLeadTime1d")}</option>
            <option value={48}>{tSet("minLeadTime2d")}</option>
            <option value={72}>{tSet("minLeadTime3d")}</option>
            <option value={96}>{tSet("minLeadTime4d")}</option>
            <option value={120}>{tSet("minLeadTime5d")}</option>
            <option value={144}>{tSet("minLeadTime6d")}</option>
            <option value={168}>{tSet("minLeadTime7d")}</option>
            <option value={192}>{tSet("minLeadTime8d")}</option>
            <option value={216}>{tSet("minLeadTime9d")}</option>
            <option value={240}>{tSet("minLeadTime10d")}</option>
            <option value={336}>{tSet("minLeadTime14d")}</option>
          </select>
          {leadTimeMessage && (
            <span className="text-xs text-emerald-600">{leadTimeMessage}</span>
          )}
        </div>
      </div>

      {/* Connect external calendars (Google / Apple). Lives here because
          it's another way of saying "I'm not available" — auto-blocks
          booking days that conflict with the photographer's personal
          calendar. */}
      <div className="mt-6 rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Connect my calendars</h3>
        <p className="mt-1 text-xs text-gray-400">
          Auto-block days that are already busy on your Google or Apple Calendar.
          Only busy time ranges are read — never event titles, attendees, or any other details.
        </p>
        <div className="mt-4">
          <CalendarSyncClient />
        </div>
      </div>

      {/* Add new range */}
      <form onSubmit={handleAdd} className="mt-6 rounded-xl border border-warm-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">{t("addUnavailableDates")}</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DatePicker
            label={t("from")}
            value={dateFrom}
            onChange={setDateFrom}
            min={today}
            placeholder={t("startDate")}
          />
          <DatePicker
            label={t("until")}
            value={dateTo}
            onChange={setDateTo}
            min={dateFrom || today}
            placeholder={t("endDate")}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700">{t("reasonOptional")}</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !dateFrom || !dateTo}
          className="mt-4 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? t("saving") : t("addUnavailablePeriod")}
        </button>
      </form>

      {/* Active ranges */}
      {loading ? (
        <p className="mt-6 text-sm text-gray-400">{t("loading")}</p>
      ) : activeRanges.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-warm-300 p-6 text-center">
          <p className="text-sm text-gray-400">{t("noUnavailableDates")}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {activeRanges.map((r) => {
            const isOngoing = r.date_from <= today && r.date_to >= today;
            return (
              <div key={r.id} className={`flex items-center justify-between rounded-xl border p-4 ${isOngoing ? "border-red-200 bg-red-50" : "border-warm-200 bg-white"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isOngoing ? "text-red-700" : "text-gray-900"}`}>
                      {formatRange(r.date_from, r.date_to, locale)}
                    </span>
                    {isOngoing && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase">{t("now")}</span>
                    )}
                  </div>
                  {r.reason && <p className="mt-0.5 text-xs text-gray-500">{r.reason}</p>}
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  title={t("remove")}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Past ranges archive */}
      {pastRanges.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition"
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${showArchive ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {t("archive")} ({pastRanges.length})
          </button>
          {showArchive && (
            <div className="mt-3 space-y-2">
              {pastRanges.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-warm-200 bg-warm-50 p-3 opacity-60">
                  <div>
                    <span className="text-sm text-gray-500">{formatRange(r.date_from, r.date_to, locale)}</span>
                    {r.reason && <span className="ml-2 text-xs text-gray-400">— {r.reason}</span>}
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg p-1 text-gray-300 transition hover:text-red-500"
                    title={t("remove")}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
