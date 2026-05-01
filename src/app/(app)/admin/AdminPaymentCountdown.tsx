"use client";

import { useEffect, useState } from "react";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Compact countdown for admin lists. Use `inline` mode for the row-header pill,
// or default block mode for the expanded detail panel.
export function AdminPaymentCountdown({ confirmedAt, inline = false }: { confirmedAt: string; inline?: boolean }) {
  const deadline = new Date(confirmedAt).getTime() + WINDOW_MS;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadline - now;
  const expired = remaining <= 0;
  const urgent = !expired && remaining < 6 * 60 * 60 * 1000;

  let timeStr: string;
  if (expired) {
    timeStr = "expired";
  } else {
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  if (inline) {
    return (
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold tabular-nums ${
          expired ? "bg-red-100 text-red-700" : urgent ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"
        }`}
        title={expired ? "Payment overdue — eligible for auto-cancel" : "Time until auto-cancel"}
      >
        ⏰ {timeStr}
      </span>
    );
  }

  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-xs flex items-center justify-between ${
        expired ? "border-red-300 bg-red-50 text-red-800" : urgent ? "border-red-300 bg-red-50 text-red-800" : "border-yellow-300 bg-yellow-50 text-yellow-900"
      }`}
    >
      <span className="font-medium">
        {expired ? "Payment overdue — eligible for auto-cancel" : "Auto-cancel in"}
      </span>
      <span className="font-mono font-bold tabular-nums">{timeStr}</span>
    </div>
  );
}
