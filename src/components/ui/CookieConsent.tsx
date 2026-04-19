"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("cookie");

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const delay = isMobile ? 15000 : 1000;
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    window.dispatchEvent(new Event("cookie-consent-update"));
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("cookie-consent", "essential-only");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-warm-200 bg-white p-4 shadow-lg sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          <p>
            {t("message")}{" "}
            <Link href="/privacy" className="text-primary-600 underline hover:text-primary-700">
              {t("privacyPolicy")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={decline}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            {t("essentialOnly")}
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
