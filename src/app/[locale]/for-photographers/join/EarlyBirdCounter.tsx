"use client";

import { useTranslations } from "next-intl";

export function EarlyBirdCounter({ totalPhotographers }: { totalPhotographers: number }) {
  const t = useTranslations("join");

  // Determine current tier info
  let tierKey = "";
  let spotsLeft = 0;
  let totalSpots = 0;

  if (totalPhotographers < 10) {
    tierKey = "founding";
    spotsLeft = 10 - totalPhotographers;
    totalSpots = 10;
  } else if (totalPhotographers < 35) {
    tierKey = "early50";
    spotsLeft = 35 - totalPhotographers;
    totalSpots = 25;
  } else if (totalPhotographers < 60) {
    tierKey = "first100";
    spotsLeft = 60 - totalPhotographers;
    totalSpots = 50;
  }

  if (!tierKey) return null;

  return (
    <div className="mt-10 inline-flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-8 py-5 backdrop-blur-sm">
      <p className="text-sm font-medium text-gray-400">{t("spotsRemaining", { tier: t(`tiers.${tierKey}.label`) })}</p>
      <p className="mt-1 font-display text-5xl font-bold text-white">
        {spotsLeft}
        <span className="text-2xl text-gray-500"> / {totalSpots}</span>
      </p>
      <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
          style={{ width: `${((totalSpots - spotsLeft) / totalSpots) * 100}%` }}
        />
      </div>
    </div>
  );
}
