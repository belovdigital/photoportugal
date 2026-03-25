"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";

export function DateNegotiation({
  bookingId,
  shootDate,
  proposedDate,
  proposedBy,
  dateNote,
  isPhotographer,
  otherName,
}: {
  bookingId: string;
  shootDate: string | null;
  proposedDate: string | null;
  proposedBy: string | null;
  dateNote: string | null;
  isPhotographer: boolean;
  otherName: string;
}) {
  const router = useRouter();
  const [showPropose, setShowPropose] = useState(false);
  const [newDate, setNewDate] = useState("");
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
      body: JSON.stringify({ action: "propose", proposed_date: newDate, date_note: note || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setShowPropose(false);
      setNewDate("");
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

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });

  // Someone proposed a date and we need to respond
  if (waitingForMe) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-800">
          {otherName} proposed a new date
        </p>
        <p className="mt-1 text-sm font-bold text-gray-900">{formatDate(proposedDate!)}</p>
        {dateNote && <p className="mt-1 text-xs text-gray-500 italic">&ldquo;{dateNote}&rdquo;</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Accept Date
          </button>
          <button
            onClick={() => setShowPropose(true)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Suggest Different Date
          </button>
        </div>
        {showPropose && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-44">
              <DatePicker value={newDate} onChange={setNewDate} min={new Date().toISOString().split("T")[0]} placeholder="Select date" />
            </div>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm flex-1 min-w-[150px]" />
            <button onClick={handlePropose} disabled={loading || !newDate}
              className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              Propose
            </button>
          </div>
        )}
      </div>
    );
  }

  // We proposed and waiting for response
  if (waitingForThem) {
    return (
      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-700">
          You proposed <span className="font-bold">{formatDate(proposedDate!)}</span> — waiting for {otherName} to respond
        </p>
        {dateNote && <p className="mt-1 text-xs text-gray-500 italic">&ldquo;{dateNote}&rdquo;</p>}
      </div>
    );
  }

  // No active proposal — show "Propose new date" button for pending bookings
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowPropose(!showPropose)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        {showPropose ? "Cancel" : "Propose different date"}
      </button>
      {showPropose && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-44">
            <DatePicker value={newDate} onChange={setNewDate} min={new Date().toISOString().split("T")[0]} placeholder="Select date" />
          </div>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 flex-1 min-w-[150px]" />
          <button type="button" onClick={handlePropose} disabled={loading || !newDate}
            className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            Propose
          </button>
        </div>
      )}
    </div>
  );
}
