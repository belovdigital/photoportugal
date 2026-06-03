"use client";

import { useState } from "react";

// Standalone toggle for the photographer dashboard: "Accept Photo Portugal
// gift cards on my profile". When ON, the photographer's standard tier
// packages (auto-created in DB) become visible to gift-mode recipients.
export function GiftCardToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip(next: boolean) {
    setSaving(true);
    setError(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    try {
      const res = await fetch("/api/dashboard/gift-cards-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepts_gift_cards: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setEnabled(prev);
        setError(data.error || "Could not save");
      }
    } catch {
      setEnabled(prev);
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            🎁 Accept GIFT CARD
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            When ON, your profile appears in the gift-mode browser. Each redemption pays you a fixed amount per tier:
          </p>
          <ul className="mt-2 text-sm text-gray-700 space-y-1">
            <li>• <strong>Express</strong> (1h, 30 photos): <strong>€210</strong></li>
            <li>• <strong>Full</strong> (2h, 60 photos): <strong>€360</strong></li>
          </ul>
          <p className="mt-2 text-[11px] text-gray-400">
            Payouts are flat — no platform-plan commission applies to gift card bookings.
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <button
          onClick={() => flip(!enabled)}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
            enabled ? "bg-primary-600" : "bg-gray-300"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
