"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function BookingStatusButtons({ bookingId, currentStatus, paymentStatus }: { bookingId: string; currentStatus: string; paymentStatus?: string | null }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("bookingActions");

  async function updateStatus(status: string) {
    setUpdating(true);
    setError("");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("failedUpdate"));
      setUpdating(false);
      return;
    }
    setUpdating(false);
    router.refresh();
  }

  const errorBanner = error ? (
    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
  ) : null;

  if (currentStatus === "inquiry") {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => updateStatus("pending")} disabled={updating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {t("convertToBooking")}
          </button>
          <button onClick={() => updateStatus("cancelled")} disabled={updating}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {t("decline")}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">{t("acceptInquiryHint")}</p>
        {errorBanner}
      </div>
    );
  }

  if (currentStatus === "pending") {
    return (
      <>
        <button onClick={() => updateStatus("confirmed")} disabled={updating}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">
          {updating ? t("confirming") : t("confirm")}
        </button>
        <button onClick={() => updateStatus("cancelled")} disabled={updating}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {t("decline")}
        </button>
        {errorBanner}
      </>
    );
  }

  if (currentStatus === "confirmed") {
    return (
      <>
        <button onClick={() => updateStatus("completed")} disabled={updating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {t("markSessionDone")}
        </button>
        {errorBanner}
      </>
    );
  }

  if (currentStatus === "completed") {
    return (
      <Link
        href={`/dashboard/bookings/${bookingId}/deliver`}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {t("uploadDeliverPhotos")}
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {t("viewDelivery")}
      </Link>
    );
  }

  if (currentStatus === "cancel-only") {
    const isPaid = paymentStatus === "paid";
    const confirmMessage = isPaid
      ? t("cancelRefundConfirm")
      : t("cancelConfirm");
    return (
      <>
        <button onClick={() => { if (confirm(confirmMessage)) updateStatus("cancelled"); }} disabled={updating}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          {updating ? t("cancelling") : isPaid ? t("cancelAndRefund") : t("cancelBooking")}
        </button>
        {errorBanner}
      </>
    );
  }

  return null;
}
