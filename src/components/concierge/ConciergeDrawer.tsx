"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ConciergeChat } from "./ConciergeChat";

interface DrawerContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

// Returns no-op fallback when used outside provider (e.g. on root not-found page)
// so the Header doesn't crash and trigger the error boundary.
export function useConciergeDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) return { open: false, setOpen: () => {}, toggle: () => {} };
  return ctx;
}

export function ConciergeDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("concierge");

  // Don't show drawer when already on /concierge page (would be redundant)
  const onConciergePage = pathname.endsWith("/concierge");

  // Restore "had been opened" state from sessionStorage so drawer survives reloads
  // within the same tab session (closes if user explicitly closes it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem("concierge_drawer_open");
      if (stored === "1" && !onConciergePage) setOpen(true);
    } catch {}
  }, [onConciergePage]);

  useEffect(() => {
    try {
      sessionStorage.setItem("concierge_drawer_open", open ? "1" : "0");
    } catch {}
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll + flag for CSS (hides Intercom etc) while drawer is open
  useEffect(() => {
    if (!open) {
      document.body.removeAttribute("data-concierge-open");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-concierge-open", "true");
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute("data-concierge-open");
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Compute page context to inform AI: route + key path segments
  const pageContext = (() => {
    if (typeof window === "undefined") return undefined;
    const path = pathname || "/";
    const stripped = path.replace(/^\/(pt|de)(?=\/|$)/, "") || "/";
    if (stripped.startsWith("/photographers/") && stripped !== "/photographers") {
      const slug = stripped.split("/")[2];
      return slug ? `User is currently viewing photographer profile: ${slug}` : undefined;
    }
    if (stripped === "/photographers") return "User is browsing the photographers catalog";
    if (stripped.startsWith("/locations/")) {
      const slug = stripped.split("/")[2];
      return slug ? `User is on location page: ${slug}` : undefined;
    }
    if (stripped.startsWith("/photoshoots/")) {
      const slug = stripped.split("/")[2];
      return slug ? `User is on shoot type page: ${slug}` : undefined;
    }
    if (stripped.startsWith("/lp/")) {
      const slug = stripped.split("/")[2];
      return slug ? `User came from paid-ad LP for: ${slug}` : undefined;
    }
    if (stripped === "/") return "User is on homepage";
    return undefined;
  })();

  return (
    <DrawerContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      {/* Drawer mounts only when open + not already on /concierge page */}
      {open && !onConciergePage && (
        <>
          {/* Backdrop (mobile) */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
          />
          {/* Drawer panel */}
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-[0_0_50px_rgba(0,0,0,0.15)] lg:w-[480px]"
            role="dialog"
            aria-modal="true"
            aria-label={t("conciergeBadge")}
          >
            {/* Header — flush, gradient accent on left of title, no inner border */}
            <header className="relative flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-primary-50 via-white to-white px-4 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 shadow-sm ring-2 ring-white">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight text-gray-900">{t("conciergeBadge")}</span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-warm-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-warm-200 to-transparent" />
            </header>
            {/* Chat fills the rest — embedded mode strips its own border/rounded so it sits flush */}
            <div className="flex flex-1 flex-col overflow-hidden bg-warm-50/30">
              <ConciergeChat locale={locale} source="drawer" pageContext={pageContext} embedded />
            </div>
          </aside>
        </>
      )}
    </DrawerContext.Provider>
  );
}

// Standalone trigger button (for use in Header)
type ConciergeTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;
export function ConciergeTrigger({ children, ...rest }: ConciergeTriggerProps) {
  const { toggle } = useConciergeDrawer();
  return (
    <button onClick={toggle} type="button" {...rest}>
      {children}
    </button>
  );
}
