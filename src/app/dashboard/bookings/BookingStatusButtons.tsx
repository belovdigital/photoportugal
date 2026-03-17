"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function BookingStatusButtons({ bookingId, currentStatus }: { bookingId: string; currentStatus: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(false);
    if (res.ok) router.refresh();
  }

  if (currentStatus === "inquiry") {
    return (
      <>
        <button onClick={() => updateStatus("pending")} disabled={updating}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          Convert to Booking
        </button>
        <button onClick={() => updateStatus("cancelled")} disabled={updating}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Decline
        </button>
      </>
    );
  }

  if (currentStatus === "pending") {
    return (
      <>
        <button onClick={() => updateStatus("confirmed")} disabled={updating}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">
          Confirm
        </button>
        <button onClick={() => updateStatus("cancelled")} disabled={updating}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Decline
        </button>
      </>
    );
  }

  if (currentStatus === "confirmed") {
    return (
      <button onClick={() => updateStatus("completed")} disabled={updating}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
        Mark Session Done
      </button>
    );
  }

  if (currentStatus === "completed") {
    return (
      <Link
        href={`/dashboard/bookings/${bookingId}/deliver`}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Upload &amp; Deliver Photos
      </Link>
    );
  }

  if (currentStatus === "delivered") {
    return (
      <Link
        href={`/dashboard/bookings/${bookingId}/deliver`}
        className="inline-flex items-center gap-2 rounded-lg border border-accent-300 px-4 py-2 text-sm font-medium text-accent-700 hover:bg-accent-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        View Delivery
      </Link>
    );
  }

  if (currentStatus === "cancel-only") {
    return (
      <button onClick={() => { if (confirm("Cancel this booking?")) updateStatus("cancelled"); }} disabled={updating}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        Cancel Booking
      </button>
    );
  }

  return null;
}
