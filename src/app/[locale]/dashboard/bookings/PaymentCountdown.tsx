"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export default function PaymentCountdown({ confirmedAt, viewerRole = "client" }: { confirmedAt: string; viewerRole?: "client" | "photographer" }) {
  const t = useTranslations("bookingsPage");
  const deadline = new Date(confirmedAt).getTime() + WINDOW_MS;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadline - now;

  if (remaining <= 0) {
    if (viewerRole === "photographer") {
      return (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{t("photogPaymentOverdueLabel") || "Client payment overdue"}</strong>{" "}
          {t("photogPaymentOverdueMessage") || "This booking is eligible for auto-cancel. The slot will be released shortly."}
        </div>
      );
    }
    return (
      <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>{t("paymentOverdueLabel") || "Payment overdue"}</strong>{" "}
        {t("paymentOverdueMessage") || "Your booking may be cancelled at any time. Please pay immediately to avoid cancellation."}
      </div>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;

  // Color shifts by urgency
  const urgent = remaining < 6 * 60 * 60 * 1000;
  const wrapClass = urgent
    ? "border-red-300 bg-red-50 text-red-800"
    : "border-yellow-300 bg-yellow-50 text-yellow-900";
  const timerClass = urgent ? "text-red-700" : "text-yellow-800";

  const title = viewerRole === "photographer"
    ? (t("photogSlotHeldTitle") || "Awaiting client payment")
    : (t("slotHeldTitle") || "Slot held — pay to secure it");
  const body = viewerRole === "photographer"
    ? (t("photogSlotHeldBody") || "If the client doesn't pay by the deadline, the booking auto-cancels and the slot is released.")
    : (t("slotHeldBody") || "Payment guarantees your slot. If unpaid by the deadline, your booking will be automatically cancelled and the slot released to other clients.");

  return (
    <div className={`mt-3 rounded-lg border px-4 py-3 ${wrapClass}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs mt-0.5 opacity-80">{body}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className={`text-2xl font-mono font-bold tabular-nums ${timerClass}`}>{timeStr}</div>
          <div className="text-[10px] uppercase tracking-wide opacity-70">
            {t("timeRemaining") || "remaining"}
          </div>
        </div>
      </div>
    </div>
  );
}
