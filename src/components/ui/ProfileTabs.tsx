"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Tab = "about" | "reviews";

export function ProfileTabs({
  aboutLabel,
  reviewsLabel,
  reviewCount,
  about,
  reviews,
}: {
  aboutLabel: string;
  reviewsLabel: string;
  reviewCount: number;
  about: ReactNode;
  reviews: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("about");
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const aboutBtn = useRef<HTMLButtonElement>(null);
  const reviewsBtn = useRef<HTMLButtonElement>(null);

  // Slide indicator under active tab
  useEffect(() => {
    const target = tab === "about" ? aboutBtn.current : reviewsBtn.current;
    if (!target || !listRef.current) return;
    const parentRect = listRef.current.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    setIndicator({ left: r.left - parentRect.left, width: r.width });
  }, [tab]);

  // Sync tab with URL hash (#reviews) and intercept clicks to #reviews anywhere on page
  useEffect(() => {
    const toReviews = () => {
      setTab("reviews");
      requestAnimationFrame(() => {
        document.getElementById("profile-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    const toAbout = () => setTab("about");

    const syncFromHash = () => {
      if (window.location.hash === "#reviews") toReviews();
      else if (window.location.hash === "#about") toAbout();
    };

    const onClickAnywhere = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.('a[href="#reviews"], a[href$="#reviews"]') as HTMLAnchorElement | null;
      if (target) {
        e.preventDefault();
        if (window.location.hash !== "#reviews") history.replaceState(null, "", "#reviews");
        toReviews();
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    document.addEventListener("click", onClickAnywhere);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      document.removeEventListener("click", onClickAnywhere);
    };
  }, []);

  const tabBase = "relative px-1 sm:px-2 pb-3 text-sm font-semibold transition-colors duration-200 outline-none";
  const tabActive = "text-primary-700";
  const tabIdle = "text-gray-400 hover:text-gray-700";

  return (
    <div id="profile-tabs" className="scroll-mt-24">
      <div className="sticky top-0 z-20 -mx-4 bg-warm-50/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
        <div ref={listRef} className="relative flex gap-8 border-b border-warm-200 pt-4">
          <button
            ref={aboutBtn}
            type="button"
            onClick={() => { setTab("about"); if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search); }}
            className={`${tabBase} ${tab === "about" ? tabActive : tabIdle}`}
          >
            {aboutLabel}
          </button>
          <button
            ref={reviewsBtn}
            type="button"
            onClick={() => { setTab("reviews"); if (window.location.hash !== "#reviews") history.replaceState(null, "", "#reviews"); }}
            className={`${tabBase} ${tab === "reviews" ? tabActive : tabIdle}`}
          >
            {reviewsLabel}
            {reviewCount > 0 && (
              <span className="ml-1.5 rounded-full bg-warm-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">
                {reviewCount}
              </span>
            )}
          </button>
          {indicator && (
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-px h-[2px] rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-[left,width] duration-300 ease-out"
              style={{ left: indicator.left, width: indicator.width }}
            />
          )}
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden">
        <div
          key={tab}
          className="animate-[fadeSlide_280ms_ease-out]"
        >
          {tab === "about" ? about : reviews}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
