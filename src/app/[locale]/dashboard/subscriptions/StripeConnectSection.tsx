"use client";

import { useState, useEffect } from "react";
import { COMMISSION_RATES, SERVICE_FEE_RATE } from "@/lib/stripe";
import { useTranslations, useLocale } from "next-intl";

export function StripeConnectSection() {
  const [status, setStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const t = useTranslations("subscriptions");

  useEffect(() => {
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, onboarded: false }));
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t("failedStripeOnboarding"));
        setLoading(false);
      }
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-warm-200 bg-white p-6">
      <h2 className="text-lg font-bold text-gray-900">{t("paymentSetup")}</h2>
      <p className="mt-2 text-sm text-gray-500">
        {t("paymentSetupDesc")}
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {status === null ? (
        <div className="mt-4 h-10 w-40 animate-pulse rounded-lg bg-warm-200" />
      ) : status.onboarded ? (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100">
            <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-accent-700">{t("stripeConnected")}</p>
            <p className="text-xs text-gray-500">{t("stripeConnectedDesc")}</p>
          </div>
        </div>
      ) : status.connected ? (
        <div className="mt-4">
          <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
            {t("stripeOnboardingIncomplete")}
          </p>
          <button onClick={handleConnect} disabled={loading}
            className="mt-3 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading ? t("loading") : t("completeSetup")}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-3">
            {t("stripeNotConnected")}
          </p>
          <button onClick={handleConnect} disabled={loading}
            className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {loading ? t("settingUp") : t("connectWithStripe")}
          </button>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-warm-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("howPaymentsWork")}</h3>
        <ul className="mt-2 space-y-1 text-xs text-gray-500">
          <li>{t("paymentStep1", { fee: SERVICE_FEE_RATE * 100 })}</li>
          <li>{t("paymentStep2")}</li>
          <li>{t("paymentStep3", { free: COMMISSION_RATES.free, pro: COMMISSION_RATES.pro, premium: COMMISSION_RATES.premium })}</li>
          <li>{t("paymentStep4")}</li>
        </ul>
      </div>
    </div>
  );
}
