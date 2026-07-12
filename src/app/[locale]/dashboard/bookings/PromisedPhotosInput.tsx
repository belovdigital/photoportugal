"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Blind/no-package bookings: the assigned photographer commits how many
 *  photos the client should expect. Shown until set; editable until
 *  delivery. Feeds the delivery minimum-photos guard server-side. */
export function PromisedPhotosInput({ bookingId, initial }: { bookingId: string; initial: number | null }) {
  const t = useTranslations("bookings");
  const [value, setValue] = useState<string>(initial ? String(initial) : "");
  const [saved, setSaved] = useState<number | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 5 || n > 1000) {
      setError(t("promisedPhotosInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_promised_photos", promised_photos: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (saved && String(saved) === value) {
    return (
      <div className="rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
        📸 {t("promisedPhotosSet", { count: saved })}{" "}
        <button className="underline" onClick={() => setValue("")}>{t("promisedPhotosEdit")}</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-xs font-semibold text-amber-800">📸 {t("promisedPhotosAsk")}</p>
      <p className="mt-0.5 text-[11px] text-amber-700">{t("promisedPhotosHint")}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={5}
          max={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="50"
          className="w-24 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-500"
        />
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "…" : t("promisedPhotosSave")}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
