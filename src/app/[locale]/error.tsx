"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function Error({ reset }: { reset: () => void }) {
  const [countdown, setCountdown] = useState(30);
  const t = useTranslations("error");

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reset]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <img src="/logo.svg" alt="Photo Portugal" className="mx-auto h-8" />
        <h1 className="mt-8 font-display text-4xl font-bold text-gray-900">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-500">
          {t("description")}
        </p>
        <div className="mx-auto mt-8 flex items-center justify-center gap-6">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#f5f0eb" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="#c45d3e" strokeWidth="4"
                strokeDasharray={`${(countdown / 30) * 176} 176`} strokeLinecap="round"
                className="transition-all duration-1000" />
            </svg>
            <span className="text-lg font-bold text-gray-900">{countdown}s</span>
          </div>
          <button onClick={() => reset()}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
            {t("tryAgain")}
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          {t("contactSupport")}
          <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>
        </p>
      </div>
    </div>
  );
}
