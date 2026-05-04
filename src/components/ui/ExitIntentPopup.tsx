"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";
import { Link } from "@/i18n/navigation";

export function ExitIntentPopup() {
  const t = useTranslations("exitIntent");
  const { data: session } = useSession();
  const drawer = useConciergeDrawer();
  const [show, setShow] = useState(false);
  const [photographerContext, setPhotographerContext] = useState<{ slug: string; name: string } | null>(null);
  const [conciergeText, setConciergeText] = useState("");

  // Fire-and-forget beacon for the admin popup-stats dashboard. Tracks
  // shown / submitted / dismissed / browse_clicked so we can compute a
  // funnel: how many popups appeared, how many led to a submitted chat,
  // how many got dismissed.
  const trackEvent = useCallback((eventType: "shown" | "submitted" | "dismissed" | "browse_clicked") => {
    const pagePath = typeof window !== "undefined" ? window.location.pathname : null;
    fetch("/api/popup-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, page_path: pagePath }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const trigger = useCallback(() => {
    if (sessionStorage.getItem("exit-intent-shown")) return;
    if (window.location.pathname.match(/\/(admin|dashboard|auth|book)\//)) return;
    sessionStorage.setItem("exit-intent-shown", "1");

    const match = window.location.pathname.match(/\/photographers\/([^/?#]+)/);
    if (match) {
      const slug = match[1];
      const h1 = document.querySelector("h1");
      const name = (h1?.textContent || "").trim() || slug;
      setPhotographerContext({ slug, name });
    } else {
      setPhotographerContext(null);
    }
    setShow(true);
    trackEvent("shown");
  }, [trackEvent]);

  useEffect(() => {
    if (session) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger();
    };

    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      document.addEventListener("mouseout", handleMouseLeave);
    }

    return () => {
      document.removeEventListener("mouseout", handleMouseLeave);
    };
  }, [trigger, session]);

  if (!show) return null;
  const isPhotographerPopup = !!photographerContext;
  const photographerName = photographerContext?.name || "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => { trackEvent("dismissed"); setShow(false); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl animate-[celebrateFadeIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { trackEvent("dismissed"); setShow(false); }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-warm-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg">
            {/* Sparkles icon — signals "AI assistant" rather than a static email capture. */}
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
          </div>

          <h2 className="mt-5 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            {isPhotographerPopup
              ? t("photographerConciergeTitle", { name: photographerName })
              : t("conciergeTitle")}
          </h2>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed sm:text-base">
            {isPhotographerPopup
              ? t("photographerConciergeDescription", { name: photographerName })
              : t("conciergeDescription")}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = conciergeText.trim();
              if (!trimmed) return;
              trackEvent("submitted");
              drawer.openWith(trimmed);
              setShow(false);
              setConciergeText("");
            }}
            className="mt-6 space-y-3"
          >
            <input
              type="text"
              value={conciergeText}
              onChange={(e) => setConciergeText(e.target.value)}
              placeholder={isPhotographerPopup
                ? t("photographerConciergePlaceholder", { name: photographerName })
                : t("conciergePlaceholder")}
              aria-label={isPhotographerPopup
                ? t("photographerConciergeInputLabel", { name: photographerName })
                : t("conciergeInputLabel")}
              maxLength={500}
              autoFocus
              className="w-full rounded-xl border border-warm-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 sm:text-[15px]"
            />
            <button
              type="submit"
              className="block w-full rounded-xl bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-primary-700"
            >
              {isPhotographerPopup
                ? t("photographerConciergeCta", { name: photographerName })
                : t("conciergeCta")}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-400">{t("conciergeFootnote")}</p>
          <Link
            href="/photographers"
            onClick={() => trackEvent("browse_clicked")}
            className="mt-3 inline-block text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-primary-600"
          >
            {isPhotographerPopup ? t("comparePhotographers") : t("browse")}
          </Link>
        </div>
      </div>
    </div>
  );
}
