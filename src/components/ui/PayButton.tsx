"use client";

import { useState } from "react";

export function PayButton({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      // For now, show payment info (Stripe Elements integration would go here)
      if (data.payment) {
        alert(`Payment of €${data.payment.totalClientPays.toFixed(2)} would be processed.\n\nThis is currently in test mode. Full Stripe Checkout will be integrated soon.`);
      }
    } catch {
      setError("Payment failed");
    }
    setLoading(false);
  }

  const serviceFee = (amount * 0.1).toFixed(2);
  const total = (amount * 1.1).toFixed(2);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePay}
        disabled={loading}
        className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
      >
        {loading ? "Processing..." : `Pay €${total}`}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
