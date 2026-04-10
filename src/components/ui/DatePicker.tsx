"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";

export interface UnavailableRange {
  date_from: string;
  date_to: string;
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  label?: string;
  required?: boolean;
  placeholder?: string;
  unavailableRanges?: UnavailableRange[];
}

const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function DatePicker({ value, onChange, min, max, label, required, placeholder, unavailableRanges }: DatePickerProps) {
  const locale = useLocale();
  const t = useTranslations("common");
  const isPT = locale === "pt";
  const WEEKDAYS = isPT ? WEEKDAYS_PT : WEEKDAYS_EN;
  const MONTH_NAMES = isPT ? MONTH_NAMES_PT : MONTH_NAMES_EN;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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

  const displayValue = value
    ? new Date(value + "T12:00:00").toLocaleDateString(isPT ? "pt-PT" : "en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${label ? "mt-1" : ""} flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm transition hover:border-gray-400 focus:border-primary-500 focus:outline-none ${
          !value ? "text-gray-400" : "text-gray-900"
        }`}
      >
        <span>{displayValue || placeholder || t("selectDate")}</span>
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-warm-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-warm-100 hover:text-gray-600">
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
                      onChange(dateStr);
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
                onChange(todayStr);
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
      )}

      {/* Hidden input for form validation */}
      {required && <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />}
    </div>
  );
}
