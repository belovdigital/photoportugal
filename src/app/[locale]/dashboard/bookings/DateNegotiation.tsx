"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import DatePicker from "@/components/ui/DatePicker";

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
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value: val, label });
    }
  }
  return opts;
}

export function DateNegotiation({
  bookingId,
  shootDate,
  proposedDate,
  proposedBy,
  proposedTime,
  dateNote,
  isPhotographer,
  otherName,
}: {
  bookingId: string;
  shootDate: string | null;
  proposedDate: string | null;
  proposedBy: string | null;
  proposedTime: string | null;
  dateNote: string | null;
  isPhotographer: boolean;
  otherName: string;
}) {
  const router = useRouter();
  const td = useTranslations("dateNegotiation");
  const TIME_OPTIONS = buildTimeOptions(td("timeFlexible"));
  const [showPropose, setShowPropose] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const myRole = isPhotographer ? "photographer" : "client";
  const waitingForMe = proposedDate && proposedBy !== myRole;
  const waitingForThem = proposedDate && proposedBy === myRole;

  async function handlePropose() {
    if (!newDate) return;
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}/propose-date`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "propose", proposed_date: newDate, proposed_time: newTime || undefined, date_note: note || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setShowPropose(false);
      setNewDate("");
      setNewTime("");
      setNote("");
      router.refresh();
    }
  }

  async function handleAccept() {
    setLoading(true);
    await fetch(`/api/bookings/${bookingId}/propose-date`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    setLoading(false);
    router.refresh();
  }

  const formatDate = (d: string | Date) => {
    const s = typeof d === "string" ? d : d instanceof Date ? d.toISOString() : String(d);
    const dateStr = s.includes("T") ? s.split("T")[0] : s;
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  };

  const formatTime = (t: string) => {
    const match = TIME_OPTIONS.find(o => o.value === t);
    return match?.label || t;
  };

  const formatDateAndTime = (d: string, t: string | null) => {
    const dateStr = formatDate(d);
    return t ? `${dateStr} at ${formatTime(t)} (PT)` : dateStr;
  };

  const proposeForm = (
    <div className="mt-3 rounded-xl border border-warm-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">{td("date")}</label>
          <DatePicker value={newDate} onChange={setNewDate} min={new Date().toISOString().split("T")[0]} placeholder={td("selectDate")} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">{td("timePT")}</label>
          <select
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">{td("noteOptional")}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={td("notePlaceholder")}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handlePropose}
          disabled={loading || !newDate}
          className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? td("proposing") : td("proposeDate")}
        </button>
        <button
          type="button"
          onClick={() => { setShowPropose(false); setNewDate(""); setNewTime(""); setNote(""); }}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium"
        >
          {td("cancel")}
        </button>
      </div>
    </div>
  );

  // Someone proposed a date and we need to respond
  if (waitingForMe) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-800">
          {td("proposedNewDate", { name: otherName })}
        </p>
        <p className="mt-1 text-sm font-bold text-gray-900">{formatDateAndTime(proposedDate!, proposedTime)}</p>
        {dateNote && <p className="mt-1 text-xs text-gray-500 italic">&ldquo;{dateNote}&rdquo;</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {td("accept")}
          </button>
          <button
            type="button"
            onClick={() => setShowPropose(!showPropose)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {showPropose ? td("cancel") : td("suggestDifferent")}
          </button>
        </div>
        {showPropose && proposeForm}
      </div>
    );
  }

  // We proposed and waiting for response
  if (waitingForThem) {
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-700">
          {td("youProposed")} <span className="font-bold">{formatDateAndTime(proposedDate!, proposedTime)}</span> — {td("waitingFor", { name: otherName })}
        </p>
        {dateNote && <p className="mt-1 text-xs text-gray-500 italic">&ldquo;{dateNote}&rdquo;</p>}
      </div>
    );
  }

  // Show current date if set
  return (
    <div className="mt-2">
      {shootDate && (
        <p className="text-xs text-gray-500 mb-1">
          {td("currentDate")}: <span className="font-medium text-gray-700">{formatDate(shootDate)}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowPropose(!showPropose)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        {showPropose ? td("hide") : shootDate ? td("changeDateAndTime") : td("proposeDateAndTime")}
      </button>
      {showPropose && proposeForm}
    </div>
  );
}
