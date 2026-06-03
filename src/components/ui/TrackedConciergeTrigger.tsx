"use client";

import { ConciergeTrigger } from "@/components/concierge/ConciergeDrawer";
import { trackCTAClick } from "@/lib/analytics";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface TrackedConciergeTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  ctaName: string;
  location: string;
  children: ReactNode;
}

/**
 * ConciergeTrigger + GA4 CTA tracking, packaged as a single client island
 * so server components can drop it in without needing to define onClick
 * (functions can't cross the server/client boundary).
 */
export function TrackedConciergeTrigger({ ctaName, location, children, ...buttonProps }: TrackedConciergeTriggerProps) {
  return (
    <ConciergeTrigger
      {...buttonProps}
      onClick={() => trackCTAClick(ctaName, location)}
    >
      {children}
    </ConciergeTrigger>
  );
}
