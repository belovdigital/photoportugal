"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { clientPriceWithFee } from "@/lib/service-fee";
import { StripeLogo } from "@/components/ui/StripeLogo";

export function PayButton({ bookingId, amount, blind = false }: {
  bookingId: string;
  amount: number;
  /** Blind (summer-offer) booking: `amount` is the photographer BASE
   *  (inclusive × 0.85) and the client is charged amount / 0.85 —
   *  all-inclusive, so no service-fee line is shown. */
  blind?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const locale = useLocale();
  const t = useTranslations("payButton");

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("paymentFailed"));
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      setError(t("paymentFailedRetry"));
    }
    setLoading(false);
  }

  // Must equal the Stripe charge exactly ("Pay €248" vs "€247.50" burned us
  // once). Regular: clientPriceWithFee — same function checkout charges, a
  // whole €5 multiple, so no cents. Blind: base / 0.85, may carry cents.
  const total = blind
    ? (Math.round((Number(amount) / 0.85) * 100) / 100).toFixed(2)
    : String(clientPriceWithFee(Number(amount)));

  // Sized to match the delivery CTA on the same page — this is the highest-value
  // action a client can take, it shouldn't look lighter than "see your photos".
  // Full width on mobile, hugging right inside the countdown block on desktop.
  return (
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
      <button
        onClick={handlePay}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-accent-700 disabled:opacity-50 sm:w-auto"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("redirecting")}
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {t("pay", { total })}
          </>
        )}
      </button>
      {/* Reassurance only. The "slot locks after payment" warning that used to
          sit here is covered by the countdown block on the booking card. */}
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
        <StripeLogo className="h-[10px] w-auto text-gray-500" />
        {t("securePayment")}
      </span>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </div>
  );
}
