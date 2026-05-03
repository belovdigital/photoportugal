"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

export type ExpandableChip = {
  key: string;
  label: string;
  href?: string;
};

export function ExpandableChipList({
  items,
  visibleCount = 4,
  moreLabel,
  className = "",
  chipClassName = "",
  moreClassName = "",
}: {
  items: ExpandableChip[];
  visibleCount?: number;
  moreLabel: string;
  className?: string;
  chipClassName?: string;
  moreClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleItems = items.slice(0, visibleCount);
  const hiddenItems = items.slice(visibleCount);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 2000);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => clearCloseTimer, []);

  const baseChipClassName = `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${chipClassName}`;

  function renderChip(item: ExpandableChip, className: string) {
    return item.href ? (
      <Link key={item.key} href={item.href} className={className} onClick={() => setOpen(false)}>
        {item.label}
      </Link>
    ) : (
      <span key={item.key} className={className}>
        {item.label}
      </span>
    );
  }

  return (
    <div ref={rootRef} className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleItems.map((item) => renderChip(item, baseChipClassName))}
      {hiddenItems.length > 0 && (
        <div
          className="relative"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${moreClassName}`}
            aria-expanded={open}
          >
            {moreLabel}
          </button>
          {open && (
            <div className="absolute left-0 top-full z-30 mt-2 min-w-48 rounded-xl border border-warm-200 bg-white p-2 shadow-lg">
              <div className="flex max-w-xs flex-wrap gap-1.5">
                {hiddenItems.map((item) => renderChip(item, baseChipClassName))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
