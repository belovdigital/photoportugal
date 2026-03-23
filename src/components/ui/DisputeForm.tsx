"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const REASON_KEYS = [
  "fewer_photos",
  "wrong_location",
  "technical_issues",
  "no_show",
  "other",
] as const;

export function DisputeForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const t = useTranslations("dispute");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || !description.trim()) return;

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, reason, description: description.trim() }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.refresh(), 1500);
    } else {
      const data = await res.json();
      setError(data.error || t("failedToSubmit"));
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-blue-700">{t("submitted")}</p>
            <p className="text-sm text-blue-600">{t("submittedDesc")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-gray-500 underline underline-offset-2 transition hover:text-red-600"
      >
        {t("reportIssue")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label={t("reportIssue")}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{t("dialogTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("dialogSubtitle")}
            </p>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("whatHappened")}</label>
                <div className="mt-2 space-y-2">
                  {REASON_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={key}
                        checked={reason === key}
                        onChange={() => setReason(key)}
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">{t(`reasons.${key}`)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{t("describeIssue")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                  placeholder={t("descriptionPlaceholder")}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || !reason || !description.trim()}
                  className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("submitDispute")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
