"use client";

import { useEffect, useRef } from "react";

/**
 * Swipe-to-navigate for fullscreen lightboxes.
 * Attaches touch handlers to the target element.
 *
 * - Horizontal swipe left → onNext, right → onPrev
 * - Vertical swipe down (> 120px) → onDismiss (optional)
 * - Distinguishes swipe from tap using angle + distance thresholds
 * - Ignores pinch/zoom (multi-touch)
 */
export function useSwipeNavigation({
  enabled,
  onPrev,
  onNext,
  onDismiss,
  threshold = 50,
  dismissThreshold = 120,
}: {
  enabled: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onDismiss?: () => void;
  threshold?: number;
  dismissThreshold?: number;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startT = useRef<number>(0);
  const multi = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        multi.current = true;
        return;
      }
      multi.current = false;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startT.current = Date.now();
    };

    const onEnd = (e: TouchEvent) => {
      if (multi.current || startX.current === null || startY.current === null) {
        startX.current = null;
        startY.current = null;
        return;
      }
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX.current;
      const dy = endY - startY.current;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const dt = Date.now() - startT.current;

      startX.current = null;
      startY.current = null;

      // Ignore long presses / slow drags that are likely scrolls
      if (dt > 600) return;

      if (absX > absY && absX >= threshold) {
        if (dx < 0) onNext?.();
        else onPrev?.();
      } else if (dy > dismissThreshold && onDismiss) {
        onDismiss();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [enabled, onPrev, onNext, onDismiss, threshold, dismissThreshold]);
}
