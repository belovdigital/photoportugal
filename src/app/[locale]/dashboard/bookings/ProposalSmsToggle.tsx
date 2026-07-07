"use client";

import { useState } from "react";

// Surprise-proposal discretion notice. SMS to the client is OFF by
// default on proposal bookings so a "your photoshoot is tomorrow" /
// "new message from <photographer>" text doesn't appear on their lock
// screen and spoil the surprise. The client can opt back in here for
// this booking only — email + in-app notifications are unaffected.
export function ProposalSmsToggle({ bookingId, initialOptIn }: { bookingId: string; initialOptIn: boolean }) {
  const [optedIn, setOptedIn] = useState(initialOptIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !optedIn;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/sms-opt-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Couldn't update. Please try again.");
        setBusy(false);
        return;
      }
      setOptedIn(next);
    } catch {
      setError("Couldn't update. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 text-base">🤫</span>
        <div className="flex-1">
          {optedIn ? (
            <p className="text-sm text-amber-900">
              <strong>SMS is on for this booking.</strong> Heads-up: a text could show on your lock
              screen and spoil the surprise. You can switch it back off below.
            </p>
          ) : (
            <p className="text-sm text-amber-900">
              <strong>We&rsquo;ve turned off SMS for this proposal</strong> so a text doesn&rsquo;t
              accidentally spoil the surprise. You&rsquo;ll still get email and in-app updates. Want
              SMS for this booking anyway?
            </p>
          )}
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="mt-2 inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {busy ? "Saving…" : optedIn ? "Turn SMS off" : "Turn SMS on"}
          </button>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
