"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trackPaymentCompleted } from "@/lib/analytics";

export function PaymentTracker({ bookingAmounts }: { bookingAmounts: Record<string, number> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const payment = searchParams.get("payment");
    const bookingId = searchParams.get("booking");
    if (payment === "success" && bookingId) {
      const key = `purchase_tracked_${bookingId}`;
      if (!sessionStorage.getItem(key)) {
        const amount = bookingAmounts[bookingId] || 0;
        trackPaymentCompleted(bookingId, amount);
        sessionStorage.setItem(key, "1");
      }
    }
  }, [searchParams, bookingAmounts]);

  return null;
}
