"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Stage one ends with an explicit ask rather than a silent queue: the
 * photographer has just finished a long checklist and needs to see that it
 * went somewhere. Pressing this stamps `approval_requested_at` and pings the
 * admins.
 */
export function RequestApprovalButton() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/request-approval", { method: "POST" });
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
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
      >
        {submitting ? t("requestApprovalSubmitting") : t("requestApprovalCta")}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
