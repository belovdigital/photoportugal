"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MIN_LENGTH = 30;

export function ConfirmWithWelcomeModal({
  bookingId,
  clientFirstName,
  onConfirmed,
  onClose,
}: {
  bookingId: string;
  clientFirstName: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("bookingActions");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trimmed = text.trim();
  const ok = trimmed.length >= MIN_LENGTH;

  async function submit() {
    if (!ok || submitting) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed", welcome_message: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || t("failedUpdate") || "Failed to confirm");
      setSubmitting(false);
      return;
    }
    onConfirmed();
  }

  const remaining = Math.max(0, MIN_LENGTH - trimmed.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">
          {t("welcomeModalTitle", { name: clientFirstName })}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {t("welcomeModalSubtitle") || "Clients who hear from you right away are much more likely to pay. Take a moment to introduce yourself, mention what excites you about this shoot, and invite them to ask any questions."}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("welcomeModalPlaceholder", { name: clientFirstName }) || `Hi ${clientFirstName}! So excited about your photoshoot — looking forward to capturing this moment with you. If you have any questions about the location, what to wear, or timing, just let me know!`}
          rows={6}
          maxLength={1000}
          className="mt-4 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          autoFocus
        />

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={ok ? "text-green-600" : "text-gray-400"}>
            {ok
              ? `✓ ${t("welcomeModalOk") || "Looks great"}`
              : (t("welcomeModalNeedMore", { count: remaining }) || `${remaining} more characters needed`)}
          </span>
          <span className="text-gray-400">{trimmed.length}/1000</span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!ok || submitting}
            className="rounded-lg bg-accent-600 px-5 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? (t("confirming") || "Confirming…")
              : (t("welcomeModalConfirmCta") || "Confirm & Send Message")}
          </button>
        </div>
      </div>
    </div>
  );
}
