"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Stage one ends with an explicit ask rather than a silent queue: the
 * photographer has just finished a long checklist and needs to see that it
 * went somewhere.
 *
 * The bank-country attestation lives here rather than on the Stripe step,
 * and that is the point. By the time someone reaches Stripe they have been
 * approved and have spent hours on a profile; discovering there that they
 * cannot be paid wastes their work and our review. Asking at the moment they
 * apply is the last point where "don't apply yet" is still useful advice.
 * The answer is recorded, not just displayed — see bank_country_confirmed_at.
 */
export function RequestApprovalButton({ countryName }: { countryName: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!confirmed) {
      setError(t("bankConfirmRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/request-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_country_confirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : t("requestApprovalError"));
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("requestApprovalError"));
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4">
      <p className="text-sm font-bold text-gray-900">{t("bankConfirmTitle")}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
        {t("bankConfirmBody", { country: countryName })}
      </p>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => {
            setConfirmed(e.target.checked);
            if (e.target.checked) setError(null);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-warm-300 text-green-600 focus:ring-green-500"
        />
        <span className="text-sm font-medium text-gray-800">
          {t("bankConfirmCheckbox", { country: countryName })}
        </span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-4 w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? t("requestApprovalSubmitting") : t("requestApprovalCta")}
      </button>

      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
