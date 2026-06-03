"use client";

import { Link } from "@/i18n/navigation";
import { trackCTAClick } from "@/lib/analytics";
import type { ComponentProps, ReactNode } from "react";

interface TrackedCTALinkProps extends Omit<ComponentProps<typeof Link>, "children" | "onClick"> {
  ctaName: string;
  location: string;
  children: ReactNode;
}

/**
 * Drop-in <Link> replacement that fires a GA4 `select_content` event on
 * click. Use this for CTA buttons inside server components (where we
 * can't add onClick directly) so we can answer "how many people clicked
 * X" without wrapping every page in a client boundary.
 *
 * In Server Component-only pages this is the only client island needed
 * for tracking — the rest of the page stays server-rendered.
 */
export function TrackedCTALink({ ctaName, location, children, ...linkProps }: TrackedCTALinkProps) {
  return (
    <Link
      {...linkProps}
      onClick={() => trackCTAClick(ctaName, location)}
    >
      {children}
    </Link>
  );
}
