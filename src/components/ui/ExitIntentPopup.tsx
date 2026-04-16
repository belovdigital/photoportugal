"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export function ExitIntentPopup() {
  const t = useTranslations("exitIntent");
  const { data: session } = useSession();
  const [show, setShow] = useState(false);

  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const trigger = useCallback(() => {
    if (sessionStorage.getItem("exit-intent-shown")) return;
    if (window.location.pathname.match(/\/(admin|dashboard|auth|book)\//)) return;
    sessionStorage.setItem("exit-intent-shown", "1");
    setShow(true);
  }, []);

  useEffect(() => {
    // Desktop: mouse leaves viewport top
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };

    // Mobile: back/scroll-up pattern — use beforeunload as proxy
    // Actually, on mobile exit intent doesn't work well. Skip it.
    const isMobile = window.innerWidth < 768;
    if (!isMobile && userRole !== "photographer" && userRole !== "admin") {
      document.addEventListener("mouseout", handleMouseLeave);
    }

    return () => {
      document.removeEventListener("mouseout", handleMouseLeave);
    };
  }, [trigger]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShow(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl animate-[celebrateFadeIn_0.3s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => setShow(false)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-warm-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <h2 className="mt-5 font-display text-2xl font-bold text-gray-900">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {t("description")}
          </p>

          <div className="mt-6 space-y-3">
            <a
              href="/find-photographer"
              className="block w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("matchMe")}
            </a>
            <a
              href="/photographers"
              className="block w-full rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:shadow-md"
            >
              {t("browse")}
            </a>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            {t("free")}
          </p>
        </div>
      </div>
    </div>
  );
}
