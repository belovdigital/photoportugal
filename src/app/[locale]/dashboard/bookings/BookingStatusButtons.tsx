"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useConfirmModal } from "@/components/ui/ConfirmModal";
import { CancelWithReasonButton } from "./CancelWithReasonButton";

export function BookingStatusButtons({ bookingId, currentStatus, paymentStatus, deliveryAccepted, shootDate }: { bookingId: string; currentStatus: string; paymentStatus?: string | null; deliveryAccepted?: boolean; shootDate?: string | null }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("bookingActions");
  const locale = useLocale();
  const dateLocale = ({pt:"pt-PT",de:"de-DE",es:"es-ES",fr:"fr-FR",en:"en-US"} as Record<string,string>)[locale] || "en-US";
  const { modal, confirm } = useConfirmModal();

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
          {/* Decline an inquiry — captures reason which goes to the
              other side via email + chat + admin Telegram. */}
          <CancelWithReasonButton bookingId={bookingId} variant="decline" />
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 max-w-sm">{t("acceptInquiryHint")}</p>
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
        {/* Photographer declining a pending booking — same reason flow. */}
        <CancelWithReasonButton bookingId={bookingId} variant="decline" />
        {errorBanner}
      </>
    );
  }

  if (currentStatus === "confirmed") {
    const shootDateStr = shootDate ? (shootDate.includes("T") ? shootDate.split("T")[0] : shootDate) : null;
    const isFutureDate = shootDateStr && new Date(shootDateStr + "T23:59:59") > new Date();
    const isUnpaid = paymentStatus !== "paid";
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateStatus("completed")}
            disabled={updating || !!isFutureDate}
            title={isFutureDate ? t("markSessionDoneWait", { date: new Date(shootDateStr! + "T12:00:00").toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) }) : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${isFutureDate ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {t("markSessionDone")}
          </button>
          {/* Photographer cancellation of a confirmed-but-unpaid booking
              — captures reason, notifies client + admins. Hidden once
              the client has paid (refund flow has its own UX). */}
          {isUnpaid && (
            <CancelWithReasonButton bookingId={bookingId} variant="cancel" />
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 max-w-sm">
          {isFutureDate
            ? t("markSessionDoneWait", { date: new Date(shootDateStr! + "T12:00:00").toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric" }) })
            : t("markSessionDoneHint")}
        </p>
        {errorBanner}
      </div>
    );
  }

  if (currentStatus === "completed" && !deliveryAccepted) {
    return (
      <div>
        <Link
          href={`/dashboard/bookings/${bookingId}/deliver`}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t("uploadDeliverPhotos")}
        </Link>
        <p className="mt-1.5 text-[11px] text-gray-400 max-w-sm">{t("uploadDeliverHint")}</p>
      </div>
    );
  }

  if (currentStatus === "completed" && deliveryAccepted) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {t("deliveryAccepted")}
      </span>
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
    // Paid → existing refund path (PATCH with status=cancelled handles
    // the refund flow downstream). Unpaid → new reason-required cancel
    // endpoint so the other party + admins see why.
    if (isPaid) {
      const confirmMessage = t("cancelRefundConfirm");
      return (
        <>
          <button onClick={async () => { const ok = await confirm("Cancel Booking", confirmMessage, { danger: true, confirmLabel: "Cancel Booking" }); if (ok) updateStatus("cancelled"); }} disabled={updating}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            {updating ? t("cancelling") : t("cancelAndRefund")}
          </button>
          {errorBanner}
          {modal}
        </>
      );
    }
    return (
      <>
        <CancelWithReasonButton bookingId={bookingId} variant="cancel" />
        {errorBanner}
        {modal}
      </>
    );
  }

  return <>{modal}</>;
}
