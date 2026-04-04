"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { COMMISSION_RATES } from "@/lib/stripe";

export function EarningsCalculator() {
  const t = useTranslations("join.calculator");
  const [sessionsPerMonth, setSessionsPerMonth] = useState(4);
  const [avgPrice, setAvgPrice] = useState(200);
  const [plan, setPlan] = useState<"free" | "pro" | "premium">("free");

  const commission = COMMISSION_RATES[plan] / 100;
  const monthlyGross = sessionsPerMonth * avgPrice;
  const monthlyNet = monthlyGross * (1 - commission);
  const yearlyNet = monthlyNet * 12;

  return (
    <div className="mt-10 rounded-2xl border border-warm-200 bg-white p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Sessions slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("sessionsPerMonth")}</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              value={sessionsPerMonth}
              onChange={(e) => setSessionsPerMonth(parseInt(e.target.value))}
              className="flex-1 accent-primary-600"
            />
            <span className="w-8 text-center text-lg font-bold text-gray-900">{sessionsPerMonth}</span>
          </div>
        </div>

        {/* Avg price slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("avgPackagePrice")}</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={100}
              max={500}
              step={10}
              value={avgPrice}
              onChange={(e) => setAvgPrice(parseInt(e.target.value))}
              className="flex-1 accent-primary-600"
            />
            <span className="w-14 text-center text-lg font-bold text-gray-900">&euro;{avgPrice}</span>
          </div>
        </div>

        {/* Plan select */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t("yourPlan")}</label>
          <div className="mt-2 flex gap-1.5">
            {(["free", "pro", "premium"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  plan === p
                    ? "bg-primary-600 text-white"
                    : "bg-warm-50 text-gray-600 hover:bg-warm-100"
                }`}
              >
                {p === "free" ? "Free" : p === "pro" ? "Pro" : "Premium"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-gray-400 text-center">{COMMISSION_RATES[plan]}% {t("commission")}</p>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-accent-50 p-5 text-center">
          <p className="text-sm text-gray-500">{t("monthlyEarnings")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-accent-700">
            &euro;{Math.round(monthlyNet).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-primary-50 p-5 text-center">
          <p className="text-sm text-gray-500">{t("yearlyEarnings")}</p>
          <p className="mt-1 font-display text-3xl font-bold text-primary-700">
            &euro;{Math.round(yearlyNet).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
