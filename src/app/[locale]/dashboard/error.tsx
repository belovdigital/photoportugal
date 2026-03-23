"use client";

import { useTranslations } from "next-intl";

export default function DashboardError({ reset }: { reset: () => void }) {
  const t = useTranslations("error.dashboardError");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h2>
        <p className="mt-2 text-gray-500">{t("description")}</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t("tryAgain")}
        </button>
      </div>
    </div>
  );
}
