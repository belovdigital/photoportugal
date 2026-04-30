"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * Cancel-with-reason button + modal. Calls POST /api/bookings/[id]/cancel
 * which validates the caller is the booking's photographer or client and
 * that the booking is still cancellable (unpaid + not yet completed).
 *
 * The reason text is required (5-500 chars) and is forwarded to:
 * - the other party by email
 * - admins via Telegram
 * - the existing chat as a system message
 *
 * Variant prop swaps button text + colour:
 * - "decline" → photographer rejecting an inquiry/pending request
 * - "cancel"  → either side cancelling a confirmed-unpaid booking
 */
export function CancelWithReasonButton({
  bookingId,
  variant = "cancel",
  className,
}: {
  bookingId: string;
  variant?: "cancel" | "decline";
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations("bookingActions");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const baseClass = variant === "decline"
    ? "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    : "rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50";

  async function submit() {
    setError("");
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError(t("cancelReasonTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("failedUpdate"));
        setSubmitting(false);
        return;
      }
      setOpen(false);
      setReason("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError(t("failedUpdate"));
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || baseClass}
      >
        {variant === "decline" ? t("decline") : t("cancelBooking")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="cancel-modal-title" className="text-lg font-bold text-gray-900">
              {variant === "decline" ? t("declineTitle") : t("cancelTitle")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("cancelReasonHelp")}
            </p>

            <label htmlFor="cancel-reason" className="sr-only">
              {t("cancelReasonLabel")}
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("cancelReasonPlaceholder")}
              rows={4}
              maxLength={500}
              autoFocus
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            <div className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span>{reason.length}/500</span>
              <span>{t("cancelReasonShared")}</span>
            </div>

            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { if (!submitting) setOpen(false); }}
                disabled={submitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("keepBooking")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || reason.trim().length < 5}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting
                  ? t("cancelling")
                  : variant === "decline" ? t("declineConfirm") : t("cancelConfirm2")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
