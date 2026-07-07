"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTop() {
  const pathname = usePathname();

  // Disable browser scroll restoration
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  // Scroll to top on route change (unless hash is present).
  // Force an INSTANT jump: the global `html { scroll-behavior: smooth }`
  // (used for in-page anchor links) would otherwise ANIMATE this jump, so a
  // new page opened from a scrolled-down spot appears to "scroll up smoothly"
  // instead of opening at the top. Temporarily disable smooth for the jump.
  useEffect(() => {
    if (!window.location.hash) {
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      html.style.scrollBehavior = prev;
    }
  }, [pathname]);

  return null;
}
