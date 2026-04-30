"use client";

import { useState, useEffect, useMemo } from "react";

type Shoot = {
  id: string;
  shoot_date: string;
  shoot_time: string | null;
  status: string;
  payment_status: string;
  total_price: number | null;
  client_name: string;
  package_name: string | null;
  duration_minutes: number | null;
  location_slug: string | null;
};

type Delivery = {
  id: string;
  due_date: string;
  status: string;
  client_name: string;
  has_delivery: boolean;
};

type Blocked = { date: string; reason: string | null; source: "manual" | "synced" };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PhotographerCalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = new Date(currentMonth.year, currentMonth.month - 1, 1);
    const to = new Date(currentMonth.year, currentMonth.month + 2, 0);
    setLoading(true);
    fetch(`/api/dashboard/calendar-overview?from=${formatDate(from)}&to=${formatDate(to)}`)
      .then((r) => r.json())
      .then((data) => {
        setShoots(data.shoots || []);
        setDeliveries(data.deliveries || []);
        setBlocked(data.blockedDates || []);
      })
      .catch(() => { /* leave empty */ })
      .finally(() => setLoading(false));
  }, [currentMonth.year, currentMonth.month]);

  const shootsByDate = useMemo(() => {
    const map: Record<string, Shoot[]> = {};
    for (const s of shoots) {
      const d = s.shoot_date.split("T")[0];
      (map[d] ||= []).push(s);
    }
    return map;
  }, [shoots]);

  const deliveriesByDate = useMemo(() => {
    const map: Record<string, Delivery[]> = {};
    for (const d of deliveries) {
      (map[d.due_date] ||= []).push(d);
    }
    return map;
  }, [deliveries]);

  const blockedByDate = useMemo(() => {
    const set = new Map<string, "manual" | "synced">();
    for (const b of blocked) set.set(b.date, b.source);
    return set;
  }, [blocked]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(currentMonth.year, currentMonth.month, d);
      days.push({ date: formatDate(date), day: d, isCurrentMonth: true });
    }
    while (days.length % 7 !== 0) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + (days.length - startDow - lastDay.getDate()) + 1);
      days.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const today = formatDate(new Date());
  const selectedShoots = shootsByDate[selectedDate] || [];
  const selectedDeliveries = deliveriesByDate[selectedDate] || [];
  const selectedBlocked = blocked.find((b) => b.date === selectedDate);

  const prevMonth = () => setCurrentMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCurrentMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(formatDate(now));
  };

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Your calendar</h3>
        {loading && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Mini calendar */}
        <div className="lg:w-72 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-warm-100 text-gray-500" aria-label="Previous month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
              </span>
              <button onClick={goToday} className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Today</button>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-warm-100 text-gray-500" aria-label="Next month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map(({ date, day, isCurrentMonth }) => {
              const hasShoot = !!shootsByDate[date]?.length;
              const hasDelivery = !!deliveriesByDate[date]?.length;
              const blockSrc = blockedByDate.get(date);
              const isSelected = date === selectedDate;
              const isToday = date === today;

              // Style precedence: selected > blocked > today > current-month > out-of-month.
              let cellCls = "text-gray-300";
              if (isSelected) cellCls = "bg-primary-500 text-white";
              else if (blockSrc && isCurrentMonth) cellCls = "bg-gray-100 text-gray-400 line-through";
              else if (isToday) cellCls = "bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-300";
              else if (isCurrentMonth) cellCls = "text-gray-900 hover:bg-warm-50";

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg text-sm transition ${cellCls}`}
                >
                  <span className="text-[13px]">{day}</span>
                  {(hasShoot || hasDelivery) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {hasShoot && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} />}
                      {hasDelivery && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-orange-400"}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-warm-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Shoot</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Delivery due</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Busy</span>
          </div>
        </div>

        {/* Day detail */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h4>

          {selectedBlocked && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Blocked.</span>{" "}
              {selectedBlocked.source === "manual"
                ? selectedBlocked.reason || "Marked unavailable in your settings."
                : "Your synced calendar has a busy event on this day."}
            </div>
          )}

          {selectedShoots.length === 0 && selectedDeliveries.length === 0 ? (
            <p className="text-sm text-gray-400 italic">{selectedBlocked ? "No bookings on this day." : "No bookings or deliveries on this day."}</p>
          ) : (
            <div className="space-y-2">
              {selectedShoots.map((s) => {
                const isPast = selectedDate < today;
                const timeLabel = s.shoot_time || "Time TBD";
                return (
                  <a
                    key={`shoot-${s.id}`}
                    href="/dashboard/bookings"
                    className={`block rounded-xl border bg-white p-3 transition ${isPast ? "border-gray-200 opacity-70" : "border-blue-200 hover:border-blue-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isPast ? "bg-gray-300" : "bg-blue-500"}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{s.client_name}</div>
                          <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                            <span>📷 {timeLabel}</span>
                            {s.duration_minutes && <span>· {s.duration_minutes} min</span>}
                            {s.package_name && <span>· {s.package_name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.total_price && (
                          <span className="text-sm font-semibold text-gray-900">€{Math.round(s.total_price)}</span>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          s.payment_status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {s.payment_status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
              {selectedDeliveries.map((d) => {
                const isOverdue = d.due_date < today;
                return (
                  <a
                    key={`delivery-${d.id}`}
                    href="/dashboard/bookings"
                    className={`block rounded-xl border bg-white p-3 transition ${
                      isOverdue ? "border-red-200 bg-red-50/30" : "border-orange-200 hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-orange-400"}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">Deliver to {d.client_name}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {isOverdue ? <span className="text-red-600 font-medium">OVERDUE — </span> : null}
                          Due {new Date(d.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
