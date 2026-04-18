"use client";

import { useEffect, useState, type ReactNode } from "react";

export function ProfileTabs({
  aboutLabel,
  reviewsLabel,
  reviewCount,
  about,
  portfolio,
  reviews,
}: {
  aboutLabel: string;
  reviewsLabel: string;
  reviewCount: number;
  about: ReactNode;
  portfolio: ReactNode;
  reviews: ReactNode;
}) {
  const [tab, setTab] = useState<"about" | "reviews">("about");

  useEffect(() => {
    const syncFromHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#reviews") setTab("reviews");
      else if (window.location.hash === "#about") setTab("about");
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const tabClass = (active: boolean) =>
    `flex-1 sm:flex-none px-1 sm:px-2 pb-3 text-sm font-semibold transition border-b-2 -mb-px ${
      active
        ? "border-primary-600 text-primary-700"
        : "border-transparent text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div id="reviews" className="scroll-mt-24">
      <div className="sticky top-16 z-10 -mx-4 border-b border-warm-200 bg-warm-50/95 px-4 backdrop-blur sm:top-0 sm:mx-0 sm:px-0">
        <div className="flex gap-6 pt-3">
          <button type="button" onClick={() => setTab("about")} className={tabClass(tab === "about")}>
            {aboutLabel}
          </button>
          <button type="button" onClick={() => setTab("reviews")} className={tabClass(tab === "reviews")}>
            {reviewsLabel}{reviewCount > 0 && <span className="ml-1.5 text-gray-400">({reviewCount})</span>}
          </button>
        </div>
      </div>

      <div className="mt-8">
        {tab === "about" ? (
          <div className="space-y-12">
            {about}
            {portfolio}
          </div>
        ) : (
          reviews
        )}
      </div>
    </div>
  );
}
