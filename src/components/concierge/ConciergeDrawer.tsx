"use client";

import { useEffect, useState, createContext, useContext, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ConciergeChat } from "./ConciergeChat";
import { derivePageContext, type PageContext } from "@/lib/concierge/page-context";

interface DrawerContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  /** Open the drawer AND seed the chat with a user message (auto-sent on
   *  first mount of the chat). Used by location/landing pages so visitors
   *  can type "couples shoot in Sintra next week" into a quick form and
   *  drop straight into a conversation with the AI. The optional
   *  `meta.chip` records which pre-prompt chip the visitor clicked, for
   *  conversion-rate analytics on which chips actually convert. */
  openWith: (message: string, meta?: { chip?: string }) => void;
  /** Pending message to inject as a user message when the chat mounts.
   *  Cleared by `consumeInitialMessage` after the chat reads it so a
   *  subsequent open doesn't replay the same message. */
  initialMessage?: string;
  /** Verbatim chip text if openWith was invoked from a chip click. */
  initialChip?: string;
  consumeInitialMessage: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

// Returns no-op fallback when used outside provider (e.g. on root not-found page)
// so the Header doesn't crash and trigger the error boundary.
export function useConciergeDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) return { open: false, setOpen: () => {}, toggle: () => {}, openWith: () => {}, consumeInitialMessage: () => {} } as DrawerContextValue;
  return ctx;
}

export function ConciergeDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);
  const [initialChip, setInitialChip] = useState<string | undefined>(undefined);
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("concierge");
  const tc = useTranslations("common");

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
  // Open the drawer with a pending user message that the chat will auto-send
  // on mount. Full integration with ConciergeChat is parked — for now this
  // just opens the drawer and stores the message for a later wiring pass.
  const openWith = useCallback((message: string, meta?: { chip?: string }) => {
    setInitialMessage(message);
    setInitialChip(meta?.chip);
    setOpen(true);
  }, []);
  const consumeInitialMessage = useCallback(() => {
    setInitialMessage(undefined);
    setInitialChip(undefined);
  }, []);

  // Structured page context — drives the context-aware first message in
  // ConciergeChat AND informs the AI server-side. Recomputed when the
  // route changes so reopening the drawer on a different page picks up
  // the new context. Memoised for stable identity in props.
  const pageContextObj = useMemo<PageContext>(
    () => derivePageContext(pathname || "/"),
    [pathname]
  );

  return (
    <DrawerContext.Provider value={{ open, setOpen, toggle, openWith, initialMessage, initialChip, consumeInitialMessage }}>
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
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight text-gray-900">{t("conciergeBadge")}</span>
                  <span className="flex flex-wrap items-center gap-x-1 gap-y-0 text-[11px] leading-tight">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      {t("online")}
                    </span>
                    <span className="text-gray-400" aria-hidden>·</span>
                    <span className="truncate text-gray-500">{t("assistantTagline")}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={tc("close")}
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
              <ConciergeChat locale={locale} source="drawer" pageContextObj={pageContextObj} embedded />
            </div>
          </aside>
        </>
      )}
    </DrawerContext.Provider>
  );
}

// Standalone trigger button (for use in Header).
// Allows a caller-provided onClick that runs BEFORE drawer toggle, so
// analytics/tracking can fire without preventing the drawer from opening.
type ConciergeTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">;
export function ConciergeTrigger({ children, onClick, ...rest }: ConciergeTriggerProps) {
  const { toggle } = useConciergeDrawer();
  return (
    <button
      {...rest}
      type="button"
      onClick={(e) => { onClick?.(e); toggle(); }}
    >
      {children}
    </button>
  );
}
