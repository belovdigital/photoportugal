"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface Plan {
  key: string;
  name: string;
  price: number;
  current: boolean;
  features: string[];
}

export function PlanCard({ plan, currentPlan, earlyBirdActive }: { plan: Plan; currentPlan: string; earlyBirdActive?: boolean }) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations("subscriptions");
  const locale = useLocale();

  const planOrder = ["free", "pro", "premium"];
  const currentIdx = planOrder.indexOf(currentPlan);
  const planIdx = planOrder.indexOf(plan.key);
  const isUpgrade = planIdx > currentIdx;
  const isDowngrade = planIdx < currentIdx;

  async function handleAction() {
    setLoading(true);
    if (plan.key === "free") {
      // Downgrade to free = open billing portal to cancel
      const res = await fetch("/api/stripe/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal", locale }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } else {
      const res = await fetch("/api/stripe/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", plan: plan.key, locale }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    }
    setLoading(false);
  }

  async function handleManage() {
    setLoading(true);
    const res = await fetch("/api/stripe/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "portal", locale }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  return (
    <div className={`relative flex flex-col rounded-xl border p-6 ${
      plan.key === "premium" ? "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200 shadow-lg" :
      plan.current ? "border-primary-200 bg-warm-50 ring-1 ring-primary-100" : "border-warm-200 bg-white"
    }`}>
      {plan.key === "premium" && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-xs font-bold text-white shadow">
          {t("mostPopular")}
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
      <div className="mt-2">
        <span className="text-3xl font-bold text-gray-900">&euro;{plan.price}</span>
        {plan.price > 0 && <span className="text-gray-500">{t("perMonth")}</span>}
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {/* Action button */}
      <div className="mt-6">
        {plan.current ? (
          <>
            <p className="text-center text-sm font-semibold text-primary-600">
              {earlyBirdActive ? t("activeEarlyBird") : t("currentPlan")}
            </p>
            {currentPlan !== "free" && !earlyBirdActive && (
              <button
                onClick={handleManage}
                disabled={loading}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? t("loading") : t("manageBilling")}
              </button>
            )}
          </>
        ) : earlyBirdActive ? (
          <p className="text-center text-xs text-gray-400">
            {planIdx < planOrder.indexOf(currentPlan) ? t("includedInPlan") : ""}
          </p>
        ) : isUpgrade ? (
          <button
            onClick={handleAction}
            disabled={loading}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              plan.key === "premium" ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg" : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {loading ? t("redirecting") : t("upgradeTo", { plan: plan.name })}
          </button>
        ) : isDowngrade ? (
          <button
            onClick={handleAction}
            disabled={loading}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? t("loading") : plan.key === "free" ? t("downgrade") : t("switchTo", { plan: plan.name })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
