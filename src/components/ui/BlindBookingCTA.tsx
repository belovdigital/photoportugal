"use client";

import type { ReactNode } from "react";
import { useConciergeDrawer } from "@/components/concierge/ConciergeDrawer";
import { trackCTAClick } from "@/lib/analytics";

// Triggers the Concierge drawer with a pre-prompt designed to push the
// LLM straight toward an offer_blind_booking action. Use on landing
// surfaces (find-photographer top card, locations pages, homepage hero
// sub-link) — the message text is what lets the AI skip 2-3 discovery
// turns and offer the blind booking sooner.
interface BlindBookingCTAProps {
  /** Pre-prompt sent into the Concierge chat as the visitor's first
   *  message. Should be specific enough that the AI can immediately
   *  ask for the missing slots (date / party size / occasion) and emit
   *  offer_blind_booking. */
  message: string;
  /** Stable label for GA4 CTA tracking — "blind_homepage", "blind_findphoto", etc. */
  ctaName: string;
  /** Where the click happened — page slug or path. */
  location: string;
  className?: string;
  children: ReactNode;
}

export function BlindBookingCTA({
  message,
  ctaName,
  location,
  className,
  children,
}: BlindBookingCTAProps) {
  const { openWith } = useConciergeDrawer();
  return (
    <button
      type="button"
      onClick={() => {
        trackCTAClick(ctaName, location);
        openWith(message, { chip: "blind_booking" });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
