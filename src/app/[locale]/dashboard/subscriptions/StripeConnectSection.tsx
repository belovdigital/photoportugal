"use client";

import { useState, useEffect } from "react";
import { COMMISSION_RATES, SERVICE_FEE_RATE } from "@/lib/stripe";
import { useTranslations, useLocale } from "next-intl";

type StripeRequirements = {
  disabled_reason: string | null;
  deadline: string | null;
  currently_due: string[];
  past_due: string[];
  pending_verification: string[];
};

type StripeStatus = {
  connected: boolean;
  onboarded: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: StripeRequirements;
};

// Stripe returns raw field paths ("individual.dob.day"). Collapse them to the
// handful of things a photographer actually has to go and do, deduped and in a
// stable order, so the banner reads like a to-do list rather than an API dump.
const REQUIREMENT_LABELS: [RegExp, string][] = [
  [/^individual\.verification\.proof_of_liveness/, "reqLiveness"],
  [/^individual\.verification\.(document|additional_document)/, "reqIdDocument"],
  [/^(individual|representative)\.(first_name|last_name)/, "reqLegalName"],
  [/^(individual|representative)\.dob/, "reqDob"],
  [/^(individual|representative)\.address/, "reqAddress"],
  [/^(individual|representative)\.phone/, "reqPhone"],
  [/^(individual|representative)\.email/, "reqEmail"],
  [/^(individual|representative)\.id_number/, "reqIdNumber"],
  [/^(owners|directors|company\.owners)/, "reqOwners"],
  [/^company\./, "reqCompany"],
  [/^tos_acceptance/, "reqTos"],
  [/^external_account/, "reqBankAccount"],
  [/^business_profile\.(url|product_description)/, "reqBusinessUrl"],
  [/^business_profile\.mcc/, "reqBusinessCategory"],
];

function requirementKeys(fields: string[]): string[] {
  const keys: string[] = [];
  for (const field of fields) {
    const match = REQUIREMENT_LABELS.find(([re]) => re.test(field));
    const key = match ? match[1] : "reqOther";
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export function StripeConnectSection() {
  const [status, setStatus] = useState<StripeStatus | null>(null);
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

  // Outstanding Stripe requirements. Shown even when the account still works —
  // Stripe gives weeks of warning before it switches payouts off, and that
  // window is the whole point of this banner.
  const req = status?.requirements;
  const outstanding = req ? [...req.past_due, ...req.currently_due] : [];
  const payoutsBlocked = status?.connected && status.payouts_enabled === false;
  const urgent = !!req?.disabled_reason || (req?.past_due.length ?? 0) > 0 || payoutsBlocked;
  const showRequirements = outstanding.length > 0 || payoutsBlocked;
  const deadlineText = req?.deadline
    ? new Date(req.deadline).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;

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

      {showRequirements && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            urgent ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className={`text-sm font-semibold ${urgent ? "text-red-800" : "text-amber-900"}`}>
            {payoutsBlocked ? t("stripePayoutsBlockedTitle") : urgent ? t("stripeActionRequiredTitle") : t("stripeDeadlineTitle")}
          </p>
          <p className={`mt-1 text-sm ${urgent ? "text-red-700" : "text-amber-800"}`}>
            {payoutsBlocked
              ? t("stripePayoutsBlockedBody")
              : deadlineText
                ? t("stripeDeadlineBody", { date: deadlineText })
                : t("stripeActionRequiredBody")}
          </p>
          {outstanding.length > 0 && (
            <ul className={`mt-3 space-y-1 text-sm ${urgent ? "text-red-700" : "text-amber-800"}`}>
              {requirementKeys(outstanding).map((key) => (
                <li key={key}>• {t(key)}</li>
              ))}
            </ul>
          )}
          <button
            onClick={handleConnect}
            disabled={loading}
            className={`mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              urgent ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {loading ? t("loading") : t("stripeFixNow")}
          </button>
        </div>
      )}

      {status === null ? (
        <div className="mt-4 h-10 w-40 animate-pulse rounded-lg bg-warm-200" />
      ) : status.onboarded ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/stripe/connect/dashboard-link", { method: "POST" });
                const data = await res.json();
                if (data.url) window.open(data.url, "_blank");
                else setError(data.error || "Failed to open Stripe dashboard");
              } catch { setError("Failed to open Stripe dashboard"); }
              finally { setLoading(false); }
            }}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "…" : "Update bank / tax details"}
          </button>
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
