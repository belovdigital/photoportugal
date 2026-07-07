"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SERVICE_FEE_RATE } from "@/lib/stripe";
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

  // Render with 2 decimals to match Stripe's display exactly. Earlier
  // we Math.round'ed which produced "€248" while Stripe charged €247.50
  // — confusing the client. Always show cents now.
  // Blind: charge = base / 0.85 (all-inclusive summer offer) — must match
  // the checkout blind branch exactly, or the button promises one number
  // and Stripe charges another.
  const serviceFee = (Number(amount) * SERVICE_FEE_RATE).toFixed(2);
  const total = blind
    ? (Math.round((Number(amount) / 0.85) * 100) / 100).toFixed(2)
    : (Number(amount) * (1 + SERVICE_FEE_RATE)).toFixed(2);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("redirecting")}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {t("pay", { total })}
          </>
        )}
      </button>
      <div className="flex flex-col gap-0.5">
        {/* Blind summer offer is all-inclusive — no fee breakdown. */}
        {!blind && <span className="text-xs text-gray-400">{t("serviceFee", { fee: serviceFee })}</span>}
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
          <StripeLogo className="h-[10px] w-auto text-gray-400" />
          {t("securePayment")}
        </span>
        <span className="text-[10px] font-medium text-amber-600">⏳ {t("slotLocksOnPayment")}</span>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
