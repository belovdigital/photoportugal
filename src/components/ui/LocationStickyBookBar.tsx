"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * Mobile-only sticky bottom bar on location landing pages.
 *
 * Shows continuously while the user scrolls — "Match me with a {location}
 * photographer · from €X" + a primary CTA. Always-visible in-context CTA on
 * mobile is one of the highest-leverage conversion patterns from
 * Airbnb / Booking; on a paid-ad LP where each visit costs us, it's worth
 * the screen real estate.
 *
 * Hidden on desktop (`sm:hidden`) since the hero MatchQuickForm + scroll
 * cards already provide the same affordance up there. Hides itself when the
 * user scrolls back to within ~80px of the top so it doesn't block the
 * hero's own match form, and when they reach the page footer.
 */
export function LocationStickyBookBar({
  locationSlug,
  locationName,
  minPrice,
}: {
  locationSlug: string;
  locationName: string;
  minPrice: number | null;
}) {
  const t = useTranslations("locations.detail.stickyBar");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const docH = document.documentElement.scrollHeight;
        const winH = window.innerHeight;
        const fromBottom = docH - (y + winH);
        // Show after the user scrolls past the hero (~80vh) and hide when
        // they reach the footer area (last ~120px) so the bar never overlaps
        // the legal/links section.
        setVisible(y > winH * 0.4 && fromBottom > 120);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={`sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-warm-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      // Respect iOS home indicator + dynamic viewport — the bar sits flush
      // with the bottom safe-area inset.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {t("title", { location: locationName })}
          </p>
          {minPrice !== null && (
            <p className="text-xs text-gray-500">
              {t("from", { price: Math.round(minPrice) })}
            </p>
          )}
        </div>
        <Link
          href={`/photographers?location=${locationSlug}`}
          className="shrink-0 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition active:bg-primary-700"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
