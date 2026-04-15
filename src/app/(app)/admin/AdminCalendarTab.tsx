"use client";

import { useState, useEffect, useMemo } from "react";

interface ShootEvent {
  id: string;
  shoot_date: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  client_name: string;
  photographer_name: string;
  package_name: string | null;
}

interface DeliveryEvent {
  id: string;
  due_date: string;
  status: string;
  client_name: string;
  photographer_name: string;
  has_delivery: boolean;
}

type CalendarEvent = { type: "shoot"; data: ShootEvent } | { type: "delivery"; data: DeliveryEvent };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminCalendarTab() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [shoots, setShoots] = useState<ShootEvent[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week">("week");

  // Fetch events for a 3-month window around current month
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const from = new Date(currentMonth.year, currentMonth.month - 1, 1);
      const to = new Date(currentMonth.year, currentMonth.month + 2, 0);
      try {
        const res = await fetch(`/api/admin/calendar?from=${formatDate(from)}&to=${formatDate(to)}`, { credentials: "include" });
        const data = await res.json();
        setShoots(data.shoots || []);
        setDeliveries(data.deliveries || []);
      } catch (err) {
        console.error("Failed to fetch calendar events:", err);
      }
      setLoading(false);
    };
    fetchEvents();
  }, [currentMonth.year, currentMonth.month]);

  // Build event map: date string → events[]
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const s of shoots) {
      const date = s.shoot_date.split("T")[0];
      if (!map[date]) map[date] = [];
      map[date].push({ type: "shoot", data: s });
    }
    for (const d of deliveries) {
      const date = d.due_date.split("T")[0];
      if (!map[date]) map[date] = [];
      map[date].push({ type: "delivery", data: d });
    }
    return map;
  }, [shoots, deliveries]);

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    // Monday = 0, Sunday = 6 (ISO)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(currentMonth.year, currentMonth.month, d);
      days.push({ date: formatDate(date), day: d, isCurrentMonth: true });
    }
    // Next month padding
    while (days.length % 7 !== 0) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + (days.length - startDow - lastDay.getDate()) + 1);
      days.push({ date: formatDate(d), day: d.getDate(), isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const today = formatDate(new Date());

  // Events for selected view (day or week)
  const selectedEvents = useMemo(() => {
    if (view === "day") {
      return eventMap[selectedDate] || [];
    }
    // Week view: get the week containing selectedDate
    const selected = new Date(selectedDate + "T12:00:00");
    let dow = selected.getDay() - 1;
    if (dow < 0) dow = 6;
    const weekStart = new Date(selected);
    weekStart.setDate(weekStart.getDate() - dow);
    const events: (CalendarEvent & { eventDate: string })[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      const dayEvents = eventMap[dateStr] || [];
      for (const e of dayEvents) {
        events.push({ ...e, eventDate: dateStr });
      }
    }
    return events;
  }, [selectedDate, eventMap, view]);

  // Week highlight dates for calendar grid
  const weekDates = useMemo(() => {
    if (view !== "week") return new Set<string>();
    const selected = new Date(selectedDate + "T12:00:00");
    let dow = selected.getDay() - 1;
    if (dow < 0) dow = 6;
    const weekStart = new Date(selected);
    weekStart.setDate(weekStart.getDate() - dow);
    const dates = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dates.add(formatDate(d));
    }
    return dates;
  }, [selectedDate, view]);

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(formatDate(now));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
      {/* Left: Mini Calendar */}
      <div className="lg:w-80 shrink-0">
        <div className="rounded-xl border border-warm-200 bg-white p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-warm-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
              </span>
              <button onClick={goToToday} className="text-[11px] text-primary-600 hover:text-primary-700 font-medium">Today</button>
            </div>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-warm-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map(({ date, day, isCurrentMonth }) => {
              const events = eventMap[date] || [];
              const hasShoot = events.some((e) => e.type === "shoot");
              const hasDelivery = events.some((e) => e.type === "delivery");
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const isInWeek = weekDates.has(date) && !isSelected;

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg text-sm transition
                    ${isSelected ? "bg-primary-500 text-white" : isInWeek ? "bg-primary-50 text-primary-700" : isToday ? "bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-300" : isCurrentMonth ? "text-gray-900 hover:bg-warm-50" : "text-gray-300"}
                  `}
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

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-warm-100 flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Photoshoot</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Delivery due</span>
          </div>
        </div>
      </div>

      {/* Right: Event list */}
      <div className="flex-1 min-w-0">
        {/* View toggle + date */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {view === "day"
              ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
              : (() => {
                  const selected = new Date(selectedDate + "T12:00:00");
                  let dow = selected.getDay() - 1;
                  if (dow < 0) dow = 6;
                  const weekStart = new Date(selected);
                  weekStart.setDate(weekStart.getDate() - dow);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                })()
            }
          </h3>
          <div className="flex gap-1 bg-warm-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === "day" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >Day</button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >Week</button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="rounded-xl border border-warm-200 bg-white p-8 text-center">
            <p className="text-gray-400 text-sm">No events {view === "day" ? "on this day" : "this week"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((event, i) => {
              const eventDate = "eventDate" in event ? (event as CalendarEvent & { eventDate: string }).eventDate : selectedDate;
              const isPast = eventDate < today;

              if (event.type === "shoot") {
                const s = event.data as ShootEvent;
                const dateLabel = new Date(s.shoot_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={`shoot-${s.id}-${i}`} className={`rounded-xl border bg-white p-4 transition ${isPast ? "border-gray-200 opacity-60" : "border-blue-200 hover:border-blue-300"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isPast ? "bg-gray-300" : "bg-blue-500"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{s.client_name}</span>
                            <span className="text-gray-300">→</span>
                            <span className="text-sm font-medium text-gray-700">{s.photographer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                            <span>📷 {dateLabel}</span>
                            {s.package_name && <span>· {s.package_name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.total_price && (
                          <span className="text-sm font-semibold text-gray-900">€{Math.round(s.total_price)}</span>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium
                          ${s.payment_status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}
                        `}>
                          {s.payment_status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                        <a
                          href={`/admin#bookings`}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >View</a>
                      </div>
                    </div>
                  </div>
                );
              }

              // Delivery
              const d = event.data as DeliveryEvent;
              const dateLabel = new Date(d.due_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isOverdue = d.due_date < today;
              return (
                <div key={`delivery-${d.id}-${i}`} className={`rounded-xl border bg-white p-4 transition ${isOverdue ? "border-red-200 bg-red-50/30" : isPast ? "border-gray-200 opacity-60" : "border-orange-200 hover:border-orange-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-orange-400"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{d.photographer_name}</span>
                          <span className="text-gray-300">→</span>
                          <span className="text-sm font-medium text-gray-700">{d.client_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{isOverdue ? "🔴" : "📦"} Delivery due {dateLabel}</span>
                          {isOverdue && <span className="text-red-600 font-medium">OVERDUE</span>}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`/admin#bookings`}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium shrink-0"
                    >View</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
