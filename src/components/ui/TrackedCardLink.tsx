"use client";

import { type ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { trackCardClick } from "@/lib/track-events";

/**
 * Drop-in replacement for the i18n <Link> inside photographer cards
 * rendered by SERVER components (PhotographerCardCompact et al.), where
 * an onClick can't live. Logs a card_click photographer-stats event
 * (CTR denominator's counterpart) and navigates as usual.
 */
export function TrackedCardLink({
  photographerSlug,
  onClick,
  ...linkProps
}: ComponentProps<typeof Link> & { photographerSlug: string }) {
  return (
    <Link
      {...linkProps}
      onClick={(e) => {
        trackCardClick(photographerSlug);
        onClick?.(e);
      }}
    />
  );
}
