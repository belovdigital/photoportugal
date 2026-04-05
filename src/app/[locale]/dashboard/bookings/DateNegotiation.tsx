"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

const TIME_OPTIONS = [
  { value: "", label: "Time flexible" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
];

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
    <div className="mt-3 rounded-xl border border-warm-200 bg-warm-50 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Date</label>
          <DatePicker value={newDate} onChange={setNewDate} min={new Date().toISOString().split("T")[0]} placeholder="Select date" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Time (PT)</label>
          <select
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Meet at the main entrance"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handlePropose}
        disabled={loading || !newDate}
        className="mt-3 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
      >
        {loading ? "Proposing..." : "Propose Date"}
      </button>
    </div>
  );

  // Someone proposed a date and we need to respond
  if (waitingForMe) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-800">
          {otherName} proposed a new date
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
            Accept
          </button>
          <button
            type="button"
            onClick={() => setShowPropose(!showPropose)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {showPropose ? "Cancel" : "Suggest Different"}
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
          You proposed <span className="font-bold">{formatDateAndTime(proposedDate!, proposedTime)}</span> — waiting for {otherName} to respond
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
          Current date: <span className="font-medium text-gray-700">{formatDate(shootDate)}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowPropose(!showPropose)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        {showPropose ? "Cancel" : shootDate ? "Change date & time" : "Propose date & time"}
      </button>
      {showPropose && proposeForm}
    </div>
  );
}
