"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";

export function ExitIntentPopup() {
  const t = useTranslations("exitIntent");
  const locale = useLocale();
  const { data: session } = useSession();
  const drawer = useConciergeDrawer();
  const [show, setShow] = useState(false);
  const [saveContext, setSaveContext] = useState<{ slug: string; name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [conciergeText, setConciergeText] = useState("");

  const userRole = (session?.user as { role?: string } | undefined)?.role;

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
      setSaveContext({ slug, name });
    } else {
      setSaveContext(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveContext) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/save-for-later", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug: saveContext.slug, locale }),
      });
      if (res.ok) setStatus("sent");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => { trackEvent("dismissed"); setShow(false); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full ${saveContext ? "max-w-md" : "max-w-lg"} rounded-2xl bg-white p-8 shadow-2xl animate-[celebrateFadeIn_0.3s_ease-out]`}
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

        {saveContext ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>

            {status === "sent" ? (
              <>
                <h2 className="mt-5 font-display text-2xl font-bold text-gray-900">{t("saveSentTitle")}</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {t("saveSentDesc", { email })}
                </p>
                <button
                  onClick={() => setShow(false)}
                  className="mt-6 w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white hover:bg-primary-700"
                >
                  {t("saveClose")}
                </button>
              </>
            ) : (
              <>
                <h2 className="mt-5 font-display text-2xl font-bold text-gray-900">
                  {t("saveTitle", { name: saveContext.name })}
                </h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{t("saveDesc")}</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("saveEmailPlaceholder")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="block w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700 disabled:opacity-50"
                  >
                    {status === "loading" ? t("saveSending") : t("saveCta")}
                  </button>
                  {status === "error" && <p className="text-xs text-red-500">{t("saveError")}</p>}
                </form>

                <p className="mt-4 text-xs text-gray-400">{t("saveFooter")}</p>
              </>
            )}
          </div>
        ) : (
          // Concierge-first variant: instead of two static CTAs, drop the
          // visitor straight into a chat with the AI concierge. They type
          // what they want, popup closes, drawer opens with their text
          // already sent. Same pattern as the location-page hero form,
          // proven to outperform email-capture on landing pages.
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg">
              {/* Sparkles icon — signals "AI assistant" rather than form. */}
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>

            <h2 className="mt-5 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("conciergeTitle")}
            </h2>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed sm:text-base">
              {t("conciergeDescription")}
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
                placeholder={t("conciergePlaceholder")}
                aria-label={t("conciergeInputLabel")}
                maxLength={500}
                autoFocus
                className="w-full rounded-xl border border-warm-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 sm:text-[15px]"
              />
              <button
                type="submit"
                className="block w-full rounded-xl bg-primary-600 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-primary-700"
              >
                {t("conciergeCta")}
              </button>
            </form>

            <p className="mt-4 text-xs text-gray-400">{t("conciergeFootnote")}</p>
            <a
              href="/photographers"
              onClick={() => trackEvent("browse_clicked")}
              className="mt-3 inline-block text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-primary-600"
            >
              {t("browse")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
