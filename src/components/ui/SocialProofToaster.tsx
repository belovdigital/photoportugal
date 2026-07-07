"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";

// Tasteful TrustPulse-style activity toaster. Shows a small, dismissible
// card bottom-left ("A family shoot in Lisbon was just booked", "Someone's
// looking for a photographer in Porto"...). All copy + localization is
// done server-side in /api/social-proof, so this component is purely
// presentational — there are no i18n keys here to leak (see CLAUDE.md).
//
// Restraint by design: desktop only, only on conversion pages, max 4 cards
// per session, ~35s apart, dismiss = quiet for a few days.

interface SPEvent {
  id: string;
  kind: "booked" | "delivered" | "review" | "aggregate";
  pre: string;
  name: string | null;
  href: string | null;
  post: string;
  meta: string;
}

const INITIAL_DELAY = 9000; // let the page settle (don't fight LCP)
const SHOW_MS = 6000;
const GAP_MS = 35000;
const MAX_PER_SESSION = 4;
const DISMISS_DAYS = 3;

const DISMISS_KEY = "pp_sp_dismissed_at";
const SHOWN_KEY = "pp_sp_shown";

const ICON: Record<SPEvent["kind"], string> = {
  booked: "📸",
  delivered: "🖼️",
  review: "⭐",
  aggregate: "📈",
};

// Only run on high-intent / discovery pages. Locale prefix is already
// stripped by next-intl's usePathname.
function isAllowedPath(path: string): boolean {
  if (path === "/") return true;
  return ["/photographers", "/locations", "/photoshoots"].some(
    (p) => path === p || path.startsWith(p + "/")
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SocialProofToaster() {
  const locale = useLocale();
  const pathname = usePathname();
  const [current, setCurrent] = useState<SPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isAllowedPath(pathname)) return;
    if (typeof window === "undefined") return;

    // Desktop only — mobile bottom corners are busy (Intercom, cookie bar).
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    // Recently dismissed? stay quiet.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return;

    let shown = Number(sessionStorage.getItem(SHOWN_KEY) || 0);
    if (shown >= MAX_PER_SESSION) return;

    let cancelled = false;
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.current.push(t);
      return t;
    };

    (async () => {
      let queue: SPEvent[] = [];
      try {
        const res = await fetch(`/api/social-proof?locale=${encodeURIComponent(locale)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { events?: SPEvent[] };
        queue = shuffle(data.events || []);
      } catch {
        return; // network hiccup — just don't show anything
      }
      if (cancelled || queue.length === 0) return;

      let i = 0;
      const showNext = () => {
        if (cancelled || i >= queue.length || shown >= MAX_PER_SESSION) return;
        const ev = queue[i++];
        setCurrent(ev);
        // next frame -> slide in
        schedule(() => setVisible(true), 50);
        // slide out after SHOW_MS
        schedule(() => setVisible(false), SHOW_MS);
        // unmount + count, then schedule the next one
        schedule(() => {
          setCurrent(null);
          shown += 1;
          sessionStorage.setItem(SHOWN_KEY, String(shown));
          if (shown < MAX_PER_SESSION && i < queue.length) schedule(showNext, GAP_MS);
        }, SHOW_MS + 450);
      };
      schedule(showNext, INITIAL_DELAY);
    })();

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Re-run when navigating between allowed pages or switching locale.
  }, [pathname, locale]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setCurrent(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  if (!current) return null;

  return (
    <div
      className={`fixed bottom-6 left-4 z-40 hidden w-[330px] max-w-[calc(100vw-2rem)] transition-all duration-500 ease-out motion-reduce:transition-opacity md:block ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-start gap-3 rounded-2xl border border-warm-200 bg-white/95 p-3.5 pr-9 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-base"
        >
          {ICON[current.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-gray-800">
            {current.pre}
            {current.name &&
              (current.href ? (
                <Link href={current.href} className="font-semibold text-primary-600 hover:underline">
                  {current.name}
                </Link>
              ) : (
                current.name
              ))}
            {current.post}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
            {current.kind !== "aggregate" && (
              <svg viewBox="0 0 20 20" className="h-3 w-3 text-accent-500" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {current.meta}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
