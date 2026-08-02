"use client";

import { useEffect, useRef, useState } from "react";
import { LocationTreeOptions, getLocationTreeLabel } from "@/components/ui/LocationTreeOptions";

interface LocationTreeSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  noMatchLabel?: string;
  className?: string;
  buttonClassName?: string;
  /** When provided, the tree is filtered to nodes that cover one of these
   *  legacy location slugs — hides locations with no relevant photographers.
   *  Omit to show the full tree (existing behaviour). */
  availableSlugs?: string[];
  /**
   * Which edge of the trigger the panel hangs from. Left by default, which is
   * right for a full-width field. Inside a sentence — Quick Booking's "in
   * <region> on <date>" — the trigger is a short word sitting well to the
   * right, so a 280px panel anchored left runs past the modal and gives the
   * whole page a horizontal scrollbar.
   */
  align?: "left" | "right";
}

export function LocationTreeSelect({
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noMatchLabel,
  className = "",
  buttonClassName = "",
  availableSlugs,
  align = "left",
}: LocationTreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName}
        aria-expanded={open}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? getLocationTreeLabel(value) : placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute top-full z-[100] mt-1 w-full min-w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-warm-200 bg-white shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-800 outline-none focus:border-primary-400 md:text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto px-1 pb-1">
            <LocationTreeOptions
              selectedSlugs={value ? [value] : []}
              onSelect={(slug) => {
                onChange(slug);
                setSearch("");
                setOpen(false);
              }}
              searchQuery={search}
              availableLegacySlugs={availableSlugs}
              noMatchLabel={noMatchLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
