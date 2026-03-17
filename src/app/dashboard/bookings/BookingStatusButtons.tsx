"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    if (res.ok) {
      router.refresh();
    }
  }

  if (currentStatus === "pending") {
    return (
      <>
        <button
          onClick={() => updateStatus("confirmed")}
          disabled={updating}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={() => updateStatus("cancelled")}
          disabled={updating}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Decline
        </button>
      </>
    );
  }

  if (currentStatus === "confirmed") {
    return (
      <button
        onClick={() => updateStatus("completed")}
        disabled={updating}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Mark Completed
      </button>
    );
  }

  if (currentStatus === "cancel-only") {
    return (
      <button
        onClick={() => {
          if (confirm("Are you sure you want to cancel this booking?")) {
            updateStatus("cancelled");
          }
        }}
        disabled={updating}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Cancel Booking
      </button>
    );
  }

  return null;
}
