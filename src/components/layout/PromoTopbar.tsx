"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { QuickBookingTrigger } from "@/components/ui/QuickBookingModal";
import { trackCTAClick } from "@/lib/analytics";

// Sitewide summer super-offer bar above the header. Opens the quick-booking
// (blind) drawer — Alex wants these sold harder (2026-07-07).
//
// Hidden on transactional/self-serve surfaces where it would either
// distract from a purchase already in progress (/book) or is irrelevant
// (dashboard/admin/delivery/auth), and on photographer PROFILE pages where
// it would divert a visitor already sold on a specific photographer to the
// cheaper blind offer. Catalog/locations/blog keep it — that's discovery.
// /for-business is hidden too: a B2B visitor reading "custom quote, one
// invoice" shouldn't see a consumer €279 discount banner above it.
const HIDDEN_PREFIXES = ["/dashboard", "/admin", "/book", "/delivery", "/auth", "/try-yourself", "/gift", "/for-business"];
// photographers|fotografen|fotografos|photographes + one more segment = profile
const PROFILE_RE = /^\/(photographers|fotografen|fotografos|photographes)\/[^/]+/;

const DISMISS_COOKIE = "promo_bar_dismissed";

function readDismissed(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${DISMISS_COOKIE}=`));
}

export function PromoTopbar() {
  const t = useTranslations("promoTopbar");
  const pathname = usePathname() || "/";
  // Lazy initializer keeps SSR markup identical (false) while the client
  // first render already respects the cookie — no flash for dismissers.
  const [dismissed, setDismissed] = useState(readDismissed);

  const stripped = pathname.replace(/^\/(en|pt|de|es|fr)(?=\/|$)/, "") || "/";
  if (dismissed) return null;
  if (HIDDEN_PREFIXES.some((p) => stripped.startsWith(p))) return null;
  if (PROFILE_RE.test(stripped)) return null;

  function dismiss() {
    document.cookie = `${DISMISS_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    setDismissed(true);
  }

  return (
    <div className="relative z-40 bg-gradient-to-r from-amber-500 via-orange-500 to-primary-600 text-white">
      <QuickBookingTrigger
        className="mx-auto flex w-full max-w-7xl items-center justify-center gap-x-2 gap-y-0.5 flex-wrap px-8 py-2 text-center text-[13px] sm:text-sm font-medium cursor-pointer"
        onClick={() => trackCTAClick("quick_booking", "promo_topbar")}
      >
        <span aria-hidden="true">☀️</span>
        <span>
          {t.rich("text", {
            price: "€279",
            strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
            was: (chunks) => <s className="opacity-75 font-normal">{chunks}</s>,
          })}
        </span>
        <span className="hidden sm:inline-flex shrink-0 items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
          {t("cta")} →
        </span>
      </QuickBookingTrigger>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
