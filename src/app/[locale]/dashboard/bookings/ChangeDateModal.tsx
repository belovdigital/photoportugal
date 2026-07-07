"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import DatePicker from "@/components/ui/DatePicker";
import { todayLocalISO } from "@/lib/date-utils";

function buildTimeOptions(flexibleLabel: string) {
  const opts: { value: string; label: string }[] = [
    { value: "", label: flexibleLabel },
  ];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      opts.push({ value: val, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
    }
  }
  return opts;
}

export function ChangeDateModal({
  open,
  onClose,
  bookingId,
  shootDate,
  shootTime,
  otherName,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  shootDate: string | null;
  shootTime?: string | null;
  otherName: string;
}) {
  const router = useRouter();
  const td = useTranslations("dateNegotiation");
  const locale = useLocale();
  const dateLocale = ({ pt: "pt-PT", de: "de-DE", es: "es-ES", fr: "fr-FR", en: "en-US" } as Record<string, string>)[locale] || "en-US";
  const TIME_OPTIONS = buildTimeOptions(td("timeFlexible"));

  const [newDate, setNewDate] = useState("");
  // Raw click coords from DatePicker — sent alongside the string so
  // the server can verify and override if the two ever disagree.
  const [newDateCoords, setNewDateCoords] = useState<{ year: number; month: number; day: number } | null>(null);
  const [newTime, setNewTime] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form fields each time the modal opens so the user starts
  // from a clean slate. Lock body scroll while open so the page behind
  // doesn't drift on iOS Safari.
  useEffect(() => {
    if (open) {
      setNewDate("");
      setNewDateCoords(null);
      setNewTime("");
      setNote("");
      setError("");
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // ESC closes the modal — standard accessibility expectation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setError("");
    if (!newDate) { setError(td("pickADate") || "Please pick a date"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/propose-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          proposed_date: newDate,
          proposed_date_coords: newDateCoords,
          proposed_time: newTime || null,
          date_note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || td("submitFailed") || "Failed to send proposal");
        setSubmitting(false);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError(td("submitFailed") || "Failed to send proposal");
      setSubmitting(false);
    }
  }

  // Robust parse — booking.shoot_date can be:
  //   - null / undefined → no date set
  //   - ISO date "2026-05-07" → parse with noon-UTC anchor to dodge TZ rollover
  //   - ISO datetime "2026-05-07T12:00:00.000Z" → parse as-is
  //   - any other malformed string → "Not scheduled yet"
  const parsedDate = (() => {
    if (!shootDate) return null;
    const s = String(shootDate).trim();
    if (!s) return null;
    const iso = s.includes("T") ? s : `${s}T12:00:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  })();
  const formattedCurrent = parsedDate
    ? parsedDate.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : td("notScheduledYet") || "Not scheduled yet";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-warm-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">
              {shootDate ? td("changeDateAndTime") : td("proposeDateAndTime")}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {td("modalSubtitle", { name: otherName }) || `${otherName} will be notified to accept or propose a different time.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 p-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: "calc(90vh - 64px - 76px)" }}>
          {/* Current date — shown prominently so the user has context */}
          <div className="rounded-xl border border-warm-200 bg-warm-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {td("currentDate")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">{formattedCurrent}</p>
            {shootTime && (
              <p className="text-xs text-gray-500">{shootTime}</p>
            )}
          </div>

          {/* New date — `min` forces today as the earliest selectable
              date; the picker greys out past days. */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">{td("date")}</label>
            <div className="mt-1.5">
              <DatePicker
                value={newDate}
                onChange={(v, coords) => { setNewDate(v); setNewDateCoords(coords || null); }}
                min={todayLocalISO()}
                placeholder={td("selectDate")}
                portalPopover
              />
            </div>
          </div>

          {/* New time */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">{td("timePT")}</label>
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-primary-500 md:text-sm"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Optional note */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              {td("noteOptional") || "Note (optional)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={2}
              placeholder={td("notePlaceholder") || "Anything they should know about this date?"}
              className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500"
            />
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t border-warm-200 bg-warm-50 px-5 py-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50"
          >
            {td("cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !newDate}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? (td("sending") || "Sending…") : (td("sendForApproval") || "Send for approval")}
          </button>
        </div>
      </div>
    </div>
  );
}
