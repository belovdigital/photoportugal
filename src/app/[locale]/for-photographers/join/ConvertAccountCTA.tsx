"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Shown on /for-photographers/join to a signed-in CLIENT with an empty
 * account (no bookings, no profile): converts the existing account to
 * photographer via POST /api/auth/set-role instead of forcing a second
 * registration with a different email (the Lingyu case — 4 accounts).
 */
export function ConvertAccountCTA({ userEmail }: { userEmail: string }) {
  const t = useTranslations("join");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "photographer" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "account_has_activity" ? t("convertHasActivity") : t("convertFailed"));
        setBusy(false);
        return;
      }
      // Hard navigation so the session JWT re-syncs the role from the DB.
      window.location.href = "/dashboard";
    } catch {
      setError(t("convertFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={convert}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-8 py-4 text-base font-bold text-white shadow-lg transition hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? t("convertBusy") : t("convertCta")}
      </button>
      <p className="text-sm text-gray-500">{t("convertNote", { email: userEmail })}</p>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
