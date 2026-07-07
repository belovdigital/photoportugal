"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

export interface UnavailableRange {
  date_from: string;
  date_to: string;
}

// Raw click coordinates carried alongside the formatted date string.
// Used so the server can recompute the date from the click position
// itself and verify nothing got shifted between the click and the
// submit. `month` is 1-indexed (1=January) for zero ambiguity at the
// network boundary.
export interface DateClickCoords {
  year: number;
  month: number; // 1..12
  day: number;   // 1..31
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string, coords?: DateClickCoords) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  label?: string;
  required?: boolean;
  placeholder?: string;
  unavailableRanges?: UnavailableRange[];
  // When set, replaces the default trigger button styling. Used to
  // embed the picker inline in prose (MadLibs-style sentence) without
  // duplicating the calendar popup logic.
  triggerClassName?: string;
  // Override the trigger's display value formatter — useful when the
  // inline context wants a shorter/longer format than the default.
  formatTrigger?: (value: string) => string;
  // Hide the trailing calendar icon — set to true when used inline.
  hideIcon?: boolean;
  // Render the calendar popover in a body-level portal with fixed
  // positioning instead of an `absolute` child. Needed when the picker
  // lives inside a scroll container that clips overflow (e.g. a modal with
  // `overflow-y-auto`, which CSS forces to also clip overflow-x) — otherwise
  // the 320px calendar gets cut off at the container edge.
  portalPopover?: boolean;
}

// Map our app locales to BCP-47 codes for Intl APIs.
const INTL_LOCALES: Record<string, string> = {
  en: "en-US",
  pt: "pt-PT",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

function buildWeekdays(locale: string): string[] {
  // Build short weekday labels (Mon..Sun) for the active locale.
  // CRITICAL: format in UTC so the label matches the day passed to
  // Date.UTC(). Without timeZone:"UTC" the formatter renders the
  // UTC instant in the user's local TZ — for any user west of UTC
  // (the Americas) that shifts every label backwards by a full day,
  // and Mon..Sun silently becomes Sun..Sat.
  const fmt = new Intl.DateTimeFormat(INTL_LOCALES[locale] || locale, { weekday: "short", timeZone: "UTC" });
  // 2024-01-01 is a Monday in UTC; iterate 7 days to get Mon..Sun.
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    out.push(fmt.format(d).replace(/\.$/, "").slice(0, 3));
  }
  return out;
}

function buildMonths(locale: string): string[] {
  // CRITICAL: format in UTC. The MONTH_NAMES array is indexed by the
  // 0-indexed month we pass to Date.UTC() — without timeZone:"UTC" the
  // formatter shifts every name back by one month for users west of
  // UTC, so MONTH_NAMES[5] ("June" by index) actually renders "May",
  // and so on. The picker header then lies about which month is
  // visible while viewMonth still produces formatDate(year, 6, day) ==
  // "YYYY-07-DD" — the exact "clicked June, got July" report we kept
  // seeing from US-based clients.
  const fmt = new Intl.DateTimeFormat(INTL_LOCALES[locale] || locale, { month: "long", timeZone: "UTC" });
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2024, i, 1));
    const name = fmt.format(d);
    out.push(name.charAt(0).toUpperCase() + name.slice(1));
  }
  return out;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

export default function DatePicker({ value, onChange, min, max, label, required, placeholder, unavailableRanges, triggerClassName, formatTrigger, hideIcon, portalPopover }: DatePickerProps) {
  const locale = useLocale();
  const t = useTranslations("common");
  const WEEKDAYS = buildWeekdays(locale);
  const MONTH_NAMES = buildMonths(locale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Fixed viewport coords for the portaled popover (anchored under the
  // trigger, clamped to the viewport so it never overflows the edge).
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const initial = value ? parseDate(value) : { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const p = parseDate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Close on outside click. The portaled popover lives outside `ref`, so it
  // needs its own containment check or clicking a day would close instantly.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Position the portaled popover under the trigger, clamped to the viewport.
  // Re-runs on scroll/resize so it follows the trigger while open.
  useEffect(() => {
    if (!open || !portalPopover) return;
    function place() {
      const anchor = ref.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const PANEL_W = 320;
      const margin = 8;
      let left = r.left;
      if (left + PANEL_W > window.innerWidth - margin) left = window.innerWidth - margin - PANEL_W;
      if (left < margin) left = margin;
      setCoords({ top: r.bottom + 8, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, portalPopover]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function isDisabled(dateStr: string) {
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  }

  function isUnavailable(dateStr: string) {
    if (!unavailableRanges) return false;
    return unavailableRanges.some((r) => dateStr >= r.date_from && dateStr <= r.date_to);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const defaultDisplay = value
    ? new Date(value + "T12:00:00").toLocaleDateString(INTL_LOCALES[locale] || locale, { day: "numeric", month: "short", year: "numeric" })
    : "";
  const displayValue = value && formatTrigger ? formatTrigger(value) : defaultDisplay;

  return (
    <div ref={ref} className="relative inline-block">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={triggerClassName ?? `${label ? "mt-1" : ""} flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm transition hover:border-gray-400 focus:border-primary-500 focus:outline-none ${
          !value ? "text-gray-400" : "text-gray-900"
        }`}
      >
        <span>{displayValue || placeholder || t("selectDate")}</span>
        {!hideIcon && (
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {open && (() => {
        const panel = (
        <div
          ref={popoverRef}
          style={portalPopover && coords ? { position: "fixed", top: coords.top, left: coords.left } : undefined}
          className={`${portalPopover ? "z-[70]" : "absolute left-0 z-50 mt-2"} w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-warm-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} aria-label="Previous month" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Next month" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-xs font-medium text-gray-400">{d}</span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e-${i}`} />;
              const dateStr = formatDate(viewYear, viewMonth, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              const disabled = isDisabled(dateStr);
              const unavailable = !disabled && isUnavailable(dateStr);

              return (
                <div key={dateStr} className="group/day relative">
                  <button
                    type="button"
                    disabled={disabled || unavailable}
                    onClick={() => {
                      // Pass the raw click coordinates alongside the
                      // formatted string. The server cross-checks the two
                      // and refuses any booking where they disagree, so a
                      // string-mangling bug anywhere between here and the
                      // INSERT can no longer create a "wrong month"
                      // booking silently. month is 1-indexed for the wire
                      // format to remove all 0/1 ambiguity.
                      onChange(dateStr, { year: viewYear, month: viewMonth + 1, day });
                      setOpen(false);
                    }}
                    className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition
                      ${disabled ? "cursor-not-allowed text-gray-200" : ""}
                      ${unavailable ? "cursor-not-allowed bg-gray-50 text-gray-300 line-through" : ""}
                      ${!disabled && !unavailable ? "cursor-pointer hover:bg-primary-50" : ""}
                      ${isSelected ? "bg-primary-600 text-white hover:bg-primary-700" : ""}
                      ${isToday && !isSelected && !unavailable ? "font-bold text-primary-600" : ""}
                      ${!isSelected && !disabled && !unavailable && !isToday ? "text-gray-700" : ""}
                    `}
                  >
                    {day}
                    {isToday && !isSelected && !unavailable && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-500" />
                    )}
                  </button>
                  {unavailable && (
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] text-white group-hover/day:block">
                      {t("unavailable")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Today shortcut */}
          {!isDisabled(todayStr) && !isUnavailable(todayStr) && (
            <button
              type="button"
              onClick={() => {
                onChange(todayStr, { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() });
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                setOpen(false);
              }}
              className="mt-3 w-full rounded-lg py-1.5 text-center text-xs font-medium text-primary-600 transition hover:bg-primary-50"
            >
              {t("today")}
            </button>
          )}
        </div>
        );
        return portalPopover ? (coords ? createPortal(panel, document.body) : null) : panel;
      })()}

      {/* Hidden input for form validation */}
      {required && <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />}
    </div>
  );
}
