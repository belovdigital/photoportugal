"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export function StickyBookBar({ minPrice, photographerName }: { minPrice: number | null; photographerName: string }) {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);

  const userRole = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    // Don't show for photographers or admins
    if (userRole === "photographer" || userRole === "admin") return;

    const handleScroll = () => {
      // Show after scrolling past 400px
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [userRole]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-warm-200 bg-white/95 backdrop-blur-lg pl-4 pr-20 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {minPrice ? (
            <p className="text-sm">
              <span className="text-gray-400">From </span>
              <span className="text-lg font-bold text-gray-900">&euro;{Math.round(minPrice)}</span>
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-900 truncate">{photographerName}</p>
          )}
        </div>
        <a
          href="#message"
          className="shrink-0 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
        >
          Message
        </a>
        <a
          href="#packages"
          className="shrink-0 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-primary-300"
        >
          Packages
        </a>
      </div>
    </div>
  );
}
