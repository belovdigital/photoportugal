"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Small "?" affordance next to a metric name in /dashboard/stats.
 *
 * Photographers kept writing in to ask what "card impressions" meant,
 * so the explanation now lives one tap away from the number instead of
 * in a support chat. Click-toggled rather than hover: most photographers
 * read their stats on a phone, where hover doesn't exist.
 *
 * Rendered inside <p>/<h2>, so the whole thing is span-based — no block
 * elements, or the markup is invalid and hydration complains.
 */
export function InfoHint({
  label,
  title,
  children,
  align = "left",
}: {
  /** Accessible name for the trigger, e.g. "What counts as shown?" */
  label: string;
  title: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[10px] font-bold leading-none transition ${
          open
            ? "border-primary-400 bg-primary-50 text-primary-600"
            : "border-warm-300 text-gray-400 hover:border-primary-400 hover:text-primary-600"
        }`}
      >
        ?
      </button>
      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label={title}
          className={`absolute top-6 z-30 block w-72 max-w-[calc(100vw-3rem)] cursor-auto rounded-xl border border-warm-200 bg-white p-3 text-left font-normal normal-case shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="block text-xs font-semibold text-gray-900">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-gray-600">{children}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Miniature of a listing page with one card highlighted — the answer to
 * "what card?" is easier to show than to word. Pure markup, no images:
 * it renders identically for everyone and costs nothing to load.
 */
export function CardImpressionMockup({ youLabel, caption }: { youLabel: string; caption: string }) {
  return (
    <span className="mt-2 block rounded-lg border border-warm-200 bg-warm-50 p-2">
      <span className="block rounded-md bg-white p-2 shadow-sm">
        {/* fake listing heading + filter row */}
        <span className="mb-2 flex items-center gap-1">
          <span className="block h-1.5 w-12 rounded-full bg-warm-300" />
          <span className="block h-1.5 w-6 rounded-full bg-warm-100" />
          <span className="block h-1.5 w-4 rounded-full bg-warm-100" />
        </span>
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`relative block flex-1 overflow-hidden rounded-md border ${
                i === 1 ? "border-primary-500 ring-2 ring-primary-200" : "border-warm-200"
              }`}
            >
              <span className={`block h-9 ${i === 1 ? "bg-primary-100" : "bg-warm-100"}`} />
              <span className="block p-1">
                <span className="block h-1 w-4/5 rounded-full bg-warm-200" />
                <span className="mt-1 block h-1 w-1/2 rounded-full bg-warm-200" />
              </span>
              {i === 1 && (
                <span className="absolute left-1/2 top-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                  {youLabel}
                </span>
              )}
            </span>
          ))}
        </span>
      </span>
      <span className="mt-1.5 block text-[10px] leading-tight text-gray-500">{caption}</span>
    </span>
  );
}
