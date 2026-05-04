"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { AdminToastProvider } from "./AdminToast";
import { AuditLog as AuditLogTab } from "./AuditLog";
import AdminCalendarTab from "./AdminCalendarTab";
import { AdminConciergeTab } from "./AdminConciergeTab";
import { AdminPopupStats } from "./AdminPopupStats";
import { RedirectsManager } from "./RedirectsManager";

function NotificationLogsTab({ channel, title }: { channel: "email" | "sms" | "telegram"; title: string }) {
  const [logs, setLogs] = useState<{ id: string; channel: string; recipient: string; event: string; status: string; error_code: string | null; error_message?: string | null; from?: string; created_at: string; price?: string | null; direction?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/notification-logs?channel=${channel}`)
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [channel]);

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;

  const statusColor = (s: string) => {
    if (s === "delivered" || s === "sent") return "bg-green-100 text-green-700";
    if (s === "failed" || s === "undelivered") return "bg-red-100 text-red-700";
    if (s === "queued" || s === "sending") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-xs text-gray-400 mb-4">{channel === "sms" ? "Live from Twilio API" : "From notification logs"} · Last {logs.length} entries</p>
      {logs.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No logs found</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 rounded-lg border border-warm-200 bg-white px-3 py-2.5 text-sm">
              <span className={`shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(log.status)}`}>{log.status}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{log.event}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{log.recipient}</span>
                  {log.from && <span className="text-gray-300">from {log.from}</span>}
                </div>
                {log.error_code && <p className="text-xs text-red-500">Error {log.error_code}{log.error_message ? `: ${log.error_message}` : ""}</p>}
              </div>
              <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                {new Date(log.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationQueueTab() {
  const [items, setItems] = useState<{ id: string; channel: string; recipient: string; subject: string | null; body: string; dedup_key: string; recipient_timezone: string; send_after: string; status: string; attempts: number; last_error: string | null; created_at: string; sent_at: string | null }[]>([]);
  const [stats, setStats] = useState<{ status: string; count: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notification-queue", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setStats(d.stats || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" /></div>;

  const statusColor = (s: string) => {
    if (s === "sent") return "bg-green-100 text-green-700";
    if (s === "failed") return "bg-red-100 text-red-700";
    if (s === "pending") return "bg-blue-100 text-blue-700";
    if (s === "cancelled") return "bg-gray-100 text-gray-500";
    return "bg-gray-100 text-gray-700";
  };

  const statCounts = Object.fromEntries(stats.map(s => [s.status, parseInt(s.count)]));

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Notification Queue</h2>
      <p className="text-xs text-gray-400 mb-4">Timezone-aware deferred SMS &amp; email notifications</p>

      <div className="flex gap-3 mb-4">
        {["pending", "failed"].map(s => (
          <div key={s} className={`rounded-lg px-3 py-2 text-center ${statusColor(s)}`}>
            <div className="text-lg font-bold">{statCounts[s] || 0}</div>
            <div className="text-[11px] font-medium capitalize">{s}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Queue is empty</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border border-warm-200 bg-white px-3 py-2.5 text-sm">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(item.status)}`}>{item.status}</span>
                <span className="text-[10px] text-gray-400 uppercase">{item.channel}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{item.subject || item.body.slice(0, 80)}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span className="truncate">{item.recipient}</span>
                  <span className="text-gray-300">·</span>
                  <span>{item.recipient_timezone}</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{item.dedup_key}</div>
                {item.last_error && <p className="text-xs text-red-500 mt-0.5">{item.last_error}</p>}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                  {new Date(item.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {item.status === "pending" && (
                  <div className="text-[11px] text-blue-500 mt-0.5">
                    Send after {new Date(item.send_after).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {item.sent_at && (
                  <div className="text-[11px] text-green-600 mt-0.5">
                    Sent {new Date(item.sent_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {item.attempts > 0 && item.status !== "sent" && (
                  <div className="text-[11px] text-amber-500">Attempts: {item.attempts}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AdminStats {
  clients: number;
  photographersApproved: number;
  photographersPending: number;
  photographersReady: number;
  bookingsTotal: number;
  bookingsPending: number;
  bookingsConfirmed: number;
  bookingsCompleted: number;
  turnover: number;
  turnoverThisMonth: number;
  revenue: number;
  revenueThisMonth: number;
  reviews: number;
  messages: number;
  blogPosts: number;
  disputesOpen: number;
  inquiriesCount: number;
  matchRequestsNew: number;
  // Funnel
  funnelMessages: number;
  funnelBookings: number;
  funnelPaid: number;
  funnelDelivered: number;
  funnelAccepted: number;
  funnelReviewed: number;
}

const tabGroups = [
  {
    label: null, // no header for top group
    items: [
      { key: "calendar", label: "Calendar", icon: "calendar" },
      { key: "overview", label: "Overview", icon: "home" },
      { key: "analytics", label: "Analytics", icon: "chart" },
      { key: "visitors", label: "Recent Visitors", icon: "eye" },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "bookings", label: "Bookings", icon: "calendar" },
      { key: "inquiries", label: "Inquiries", icon: "message" },
      { key: "matchRequests", label: "Match Requests", icon: "search" },
      { key: "concierge", label: "Concierge AI", icon: "sparkles" },
      { key: "popupStats", label: "Exit Popup", icon: "chart" },
      { key: "disputes", label: "Disputes", icon: "flag" },
      { key: "reviews", label: "Reviews", icon: "star" },
    ],
  },
  {
    label: "People",
    items: [
      { key: "photographers", label: "Photographers", icon: "camera" },
      { key: "clients", label: "Clients", icon: "users" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "blog", label: "Blog", icon: "document" },
      { key: "promos", label: "Promo Codes", icon: "tag" },
      { key: "locations", label: "Locations", icon: "map" },
      { key: "redirects", label: "Redirects", icon: "search" },
    ],
  },
  {
    label: null,
    items: [
      { key: "logs", label: "Logs", icon: "document" },
      { key: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

const tabs = tabGroups.flatMap(g => g.items);

type TabKey = "overview" | "analytics" | "visitors" | "calendar" | "bookings" | "inquiries" | "matchRequests" | "concierge" | "popupStats" | "disputes" | "reviews" | "photographers" | "clients" | "blog" | "promos" | "locations" | "redirects" | "logs" | "settings";

type LogSubTab = "audit" | "email" | "sms" | "telegram" | "queue";

function SidebarIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `h-4.5 w-4.5 ${active ? "text-primary-600" : "text-gray-400"}`;
  switch (type) {
    case "home":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case "chart":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    case "camera":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "users":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    case "calendar":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "document":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>;
    case "tag":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>;
    case "eye":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
    case "message":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "flag":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>;
    case "star":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
    case "map":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "search":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "heart":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "sparkles":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>;
    default:
      return null;
  }
}

function fmtDate(day: string, bucket: "day" | "week" | "month" = "day") {
  // Handle both "2026-03-25" and "2026-03-25T00:00:00.000Z"
  const clean = day.split("T")[0];
  const [y, m, d] = clean.split("-").map(Number);
  if (!y || !m || !d) return day;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (bucket === "month") return `${months[m - 1]} ${y}`;
  if (bucket === "week") return `Week of ${months[m - 1]} ${d}`;
  return `${months[m - 1]} ${d}`;
}

function BarChart({ title, subtitle, filled, field, color, bucket }: {
  title: string; subtitle: string;
  filled: { day: string; turnover: number; revenue: number; count: number }[];
  field: "turnover" | "revenue"; color: string;
  bucket: "day" | "week" | "month";
}) {
  const max = Math.max(...filled.map(d => d[field]), 1);
  // Show ~5 date labels evenly spaced
  const labelInterval = Math.max(Math.floor(filled.length / 5), 1);

  return (
    <div className="rounded-xl border border-warm-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      <div className="mt-3 flex items-end gap-px" style={{ height: 100 }}>
        {filled.map((d) => {
          const val = d[field];
          const h = Math.max((val / max) * 100, val > 0 ? 4 : 0);
          return (
            <div key={d.day} className="group relative flex-1 cursor-default" style={{ height: "100%" }}>
              <div
                className={`absolute bottom-0 w-full rounded-t transition-colors ${val > 0 ? color : "bg-gray-100"}`}
                style={{ height: `${h}%`, minHeight: val > 0 ? 3 : 1 }}
              />
              {val > 0 && (
                <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                  {fmtDate(d.day, bucket)}: &euro;{val}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Date labels */}
      <div className="mt-1 flex">
        {filled.map((d, i) => (
          <div key={d.day} className="flex-1 text-center">
            {(i % labelInterval === 0 || i === filled.length - 1) && (
              <span className="text-[9px] text-gray-400">{fmtDate(d.day, bucket).replace(/ /g, "\u00A0")}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingEvents({ onNavigate }: { onNavigate: () => void }) {
  const [events, setEvents] = useState<{ id: string; shoot_date: string; client_name: string; photographer_name: string; total_price: number | null; payment_status: string; package_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 14 * 86400000);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    fetch(`/api/admin/calendar?from=${fmt(today)}&to=${fmt(nextWeek)}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setEvents((data.shoots || []).slice(0, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <div className="mt-4 sm:mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Photoshoots</h3>
        <button onClick={onNavigate} className="text-xs text-primary-600 hover:text-primary-700 font-medium">View Calendar →</button>
      </div>
      <div className="space-y-1.5">
        {events.map((e) => {
          const d = new Date(e.shoot_date + "T12:00:00");
          const today = new Date();
          const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);
          const dateLabel = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const isUrgent = diffDays <= 1;
          return (
            <div key={e.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${isUrgent ? "border-blue-200 bg-blue-50/50" : "border-warm-200 bg-white"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUrgent ? "bg-blue-500" : "bg-gray-300"}`} />
                <div className="min-w-0">
                  <span className="text-sm text-gray-900"><strong>{e.client_name}</strong> → {e.photographer_name}</span>
                  <div className="text-xs text-gray-500">{dateLabel}{e.package_name ? ` · ${e.package_name}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.total_price && <span className="text-sm font-semibold text-gray-900">€{Math.round(e.total_price)}</span>}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${e.payment_status === "paid" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {e.payment_status === "paid" ? "Paid" : "Unpaid"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type RevenuePreset = "7" | "30" | "90" | "365" | "all" | "custom";

function RevenueCharts() {
  const [rows, setRows] = useState<{ day: string; turnover: number; revenue: number; count: number }[]>([]);
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [preset, setPreset] = useState<RevenuePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url = "/api/admin/revenue-chart";
    if (preset === "custom") {
      if (!customFrom || !customTo) return;
      url += `?from=${customFrom}&to=${customTo}`;
    } else {
      url += `?range=${preset}`;
    }
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setRows(d.rows || []);
        setBucket(d.bucket || "day");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [preset, customFrom, customTo]);

  const totalTurnover = rows.reduce((s, d) => s + d.turnover, 0);
  const totalRevenue = rows.reduce((s, d) => s + d.revenue, 0);
  const paidBookings = rows.reduce((s, d) => s + d.count, 0);

  const presets: { key: RevenuePreset; label: string }[] = [
    { key: "7", label: "7d" },
    { key: "30", label: "30d" },
    { key: "90", label: "90d" },
    { key: "365", label: "1y" },
    { key: "all", label: "All" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-1 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                preset === p.key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : preset === "custom" && (!customFrom || !customTo) ? (
        <div className="rounded-xl border border-warm-200 bg-white p-8 text-center text-sm text-gray-400">
          Pick both a start and end date to see the chart.
        </div>
      ) : (
        <>
          <BarChart
            title="Turnover"
            subtitle={`€${totalTurnover.toLocaleString()} from ${paidBookings} paid booking${paidBookings !== 1 ? "s" : ""}${bucket !== "day" ? ` · ${bucket === "week" ? "weekly" : "monthly"} bars` : ""}`}
            filled={rows} field="turnover" color="bg-primary-500 hover:bg-primary-600"
            bucket={bucket}
          />
          <BarChart
            title="Revenue (Commission)"
            subtitle={totalRevenue > 0 ? `€${totalRevenue.toLocaleString()} earned` : "No completed payouts yet"}
            filled={rows} field="revenue" color="bg-green-500 hover:bg-green-600"
            bucket={bucket}
          />
        </>
      )}
    </div>
  );
}

export function AdminDashboard({
  stats,
  logoutButton,
  analyticsSection,
  photographersSection,
  clientsSection,
  bookingsSection,
  inquiriesSection,
  matchRequestsSection,
  visitorsSection,
  disputesSection,
  reviewsSection,
  blogSection,
  promosSection,
  locationsSection,
  settingsSection,
}: {
  stats: AdminStats;
  logoutButton: ReactNode;
  analyticsSection: ReactNode;
  photographersSection: ReactNode;
  clientsSection: ReactNode;
  bookingsSection: ReactNode;
  inquiriesSection: ReactNode;
  matchRequestsSection: ReactNode;
  visitorsSection: ReactNode;
  disputesSection: ReactNode;
  reviewsSection: ReactNode;
  blogSection: ReactNode;
  promosSection: ReactNode;
  locationsSection: ReactNode;
  settingsSection: ReactNode;
}) {
  const [activeTab, setActiveTabState] = useState<TabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  }, []);

  // Deep-link handling: #client-<id> → switch to Clients tab and scroll to
  // the row. Runs on initial mount AND on hashchange so clicks from
  // inside the dashboard (e.g. from a booking row) also work — without
  // the listener, the URL hash updates but the tab never switches.
  useEffect(() => {
    function applyDeepLink() {
      const hash = window.location.hash;
      if (hash.startsWith("#client-")) {
        setActiveTabState("clients");
        // Give the clients list a tick to mount/paginate to the row,
        // then ask the browser to scroll. AdminClientsList itself jumps
        // pages and expands the row when the hash matches.
        setTimeout(() => {
          document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    }
    applyDeepLink();
    window.addEventListener("hashchange", applyDeepLink);
    return () => window.removeEventListener("hashchange", applyDeepLink);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.location.reload();
  }, []);

  // Pull-to-refresh gesture
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // Don't intercept touches on sidebar (allows scrolling sidebar back up)
      const target = e.target as HTMLElement;
      if (target.closest("aside")) return;
      if (window.scrollY === 0 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!isPulling.current) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.5, 120));
        if (dy > 10) e.preventDefault();
      } else {
        isPulling.current = false;
        setPullDistance(0);
      }
    }
    function onTouchEnd() {
      if (isPulling.current && pullDistance >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDistance(0);
        window.location.reload();
      } else {
        setPullDistance(0);
      }
      isPulling.current = false;
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance]);

  const [logSubTab, setLogSubTab] = useState<LogSubTab>("sms");

  // Map old hash names to new format
  const LEGACY_HASH_MAP: Record<string, { tab: TabKey; logSub?: LogSubTab }> = {
    auditLog: { tab: "logs", logSub: "audit" },
    emailLogs: { tab: "logs", logSub: "email" },
    smsLogs: { tab: "logs", logSub: "sms" },
    telegramLogs: { tab: "logs", logSub: "telegram" },
    notificationQueue: { tab: "logs", logSub: "queue" },
  };

  function parseHash(hash: string): { tab: TabKey; logSub?: LogSubTab } | null {
    // New format: #logs-email
    if (hash.startsWith("logs-")) {
      const sub = hash.slice(5) as LogSubTab;
      if (["audit", "email", "sms", "telegram", "queue"].includes(sub)) {
        return { tab: "logs", logSub: sub };
      }
    }
    // Legacy format
    if (LEGACY_HASH_MAP[hash]) return LEGACY_HASH_MAP[hash];
    // Normal tab
    if (tabs.some((t) => t.key === hash)) return { tab: hash as TabKey };
    return null;
  }

  // Listen for hash changes
  useEffect(() => {
    function syncHash() {
      const parsed = parseHash(window.location.hash.slice(1));
      if (parsed) {
        setActiveTabState(parsed.tab);
        if (parsed.logSub) setLogSubTab(parsed.logSub);
        try { sessionStorage.setItem("admin-tab", parsed.logSub ? `logs-${parsed.logSub}` : parsed.tab); } catch {}
      }
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function setActiveTab(tab: TabKey) {
    setActiveTabState(tab);
    window.history.replaceState(null, "", `#${tab}`);
    try { sessionStorage.setItem("admin-tab", tab); } catch {}
  }

  function setLogTab(sub: LogSubTab) {
    setLogSubTab(sub);
    window.history.replaceState(null, "", `#logs-${sub}`);
    try { sessionStorage.setItem("admin-tab", `logs-${sub}`); } catch {}
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Sync active tab from hash or sessionStorage on mount
    const rawHash = window.location.hash.slice(1);
    const parsed = parseHash(rawHash);
    if (parsed) {
      setActiveTabState(parsed.tab);
      if (parsed.logSub) setLogSubTab(parsed.logSub);
    } else {
      try {
        const stored = sessionStorage.getItem("admin-tab") || "";
        const storedParsed = parseHash(stored);
        if (storedParsed) {
          setActiveTabState(storedParsed.tab);
          if (storedParsed.logSub) setLogSubTab(storedParsed.logSub);
          window.history.replaceState(null, "", `#${stored}`);
        }
      } catch {}
    }
  }, []);

  function getBadge(key: string): number {
    if (key === "photographers") return stats.photographersReady;
    if (key === "bookings") return stats.bookingsPending;
    if (key === "inquiries") return stats.inquiriesCount;
    if (key === "matchRequests") return stats.matchRequestsNew;
    if (key === "disputes") return stats.disputesOpen;
    return 0;
  }

  return (
    <div className="mx-auto max-w-screen-xl px-3 sm:px-6 lg:px-8 pb-20">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all md:hidden"
          style={{ height: refreshing ? 48 : pullDistance, overflow: "hidden" }}
        >
          <div className={`h-6 w-6 rounded-full border-2 border-primary-600 border-t-transparent ${
            pullDistance >= PULL_THRESHOLD || refreshing ? "animate-spin" : ""
          }`} style={!refreshing && pullDistance < PULL_THRESHOLD ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined} />
        </div>
      )}
      {/* Header — full width above sidebar */}
      <div className="flex items-center justify-between pt-4 sm:pt-8">
        <div className="flex items-center gap-3">
          {/* Mobile burger — top-left inline */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-100 text-gray-600 md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">Platform overview and management</p>
          </div>
        </div>
        {logoutButton}
      </div>

      <div className="mt-6 flex min-h-[calc(100vh-200px)]">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed left-0 top-0 z-30 h-full w-56 shrink-0 bg-warm-50 pt-[60px] transition-transform overflow-y-auto
          md:sticky md:top-0 md:h-screen md:translate-x-0 md:bg-transparent md:pt-0 md:overflow-y-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <nav className="flex flex-col pr-3 pb-8">
            {tabGroups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? "mt-4" : ""}>
                {group.label && (
                  <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{group.label}</p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const badge = getBadge(tab.key);
                    return (
                      <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key as TabKey); setSidebarOpen(false); }}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "bg-white text-primary-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <SidebarIcon type={tab.icon} active={isActive} />
                          {tab.label}
                        </span>
                        {badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content — render only after mount to avoid hydration mismatch from timestamps */}
        <div className="flex-1 min-w-0 pl-0 md:pl-6">
          {!mounted ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : <>
          {activeTab === "analytics" && analyticsSection}
          {activeTab === "overview" && (
            <div>
              {/* Key metrics — 2 rows */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-warm-200 bg-white p-3 sm:p-5">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Turnover</p>
                  <p className="mt-1 text-xl sm:text-3xl font-bold text-gray-900">&euro;{stats.turnover.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-400">&euro;{stats.turnoverThisMonth.toLocaleString()} this month</p>
                  {stats.revenue > 0 && (
                    <p className="mt-0.5 text-xs text-green-600">Revenue: &euro;{stats.revenue.toLocaleString()}</p>
                  )}
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-3 sm:p-5">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Bookings</p>
                  <p className="mt-1 text-xl sm:text-3xl font-bold text-gray-900">{stats.bookingsTotal}</p>
                  <div className="mt-1 flex gap-2 text-xs">
                    {stats.bookingsPending > 0 && <span className="text-yellow-600">{stats.bookingsPending} pending</span>}
                    {stats.bookingsConfirmed > 0 && <span className="text-blue-600">{stats.bookingsConfirmed} confirmed</span>}
                    {stats.bookingsCompleted > 0 && <span className="text-green-600">{stats.bookingsCompleted} done</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-3 sm:p-5">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Photographers</p>
                  <p className="mt-1 text-xl sm:text-3xl font-bold text-gray-900">{stats.photographersApproved}</p>
                  {stats.photographersReady > 0 && <p className="mt-1 text-xs text-green-600">{stats.photographersReady} ready for approval</p>}
                  {stats.photographersPending > 0 && stats.photographersPending > stats.photographersReady && <p className="text-xs text-gray-400">{stats.photographersPending - stats.photographersReady} filling profile</p>}
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-3 sm:p-5">
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Clients</p>
                  <p className="mt-1 text-xl sm:text-3xl font-bold text-gray-900">{stats.clients}</p>
                  <p className="mt-1 text-xs text-gray-400">{stats.reviews} reviews &middot; {stats.disputesOpen > 0 ? <span className="text-red-500">{stats.disputesOpen} disputes</span> : "0 disputes"}</p>
                </div>
              </div>

              {/* Action items — what needs attention */}
              {(stats.bookingsPending > 0 || stats.photographersReady > 0 || stats.disputesOpen > 0) && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-800">Needs Attention</h3>
                  <div className="mt-3 space-y-2">
                    {stats.bookingsPending > 0 && (
                      <button onClick={() => setActiveTab("bookings")} className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm transition hover:shadow-sm">
                        <span className="text-gray-700"><strong>{stats.bookingsPending}</strong> booking{stats.bookingsPending !== 1 ? "s" : ""} waiting for response</span>
                        <span className="text-xs text-primary-600">View &rarr;</span>
                      </button>
                    )}
                    {stats.photographersReady > 0 && (
                      <button onClick={() => setActiveTab("photographers")} className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm transition hover:shadow-sm">
                        <span className="text-gray-700"><strong>{stats.photographersReady}</strong> photographer{stats.photographersReady !== 1 ? "s" : ""} ready for approval</span>
                        <span className="text-xs text-primary-600">Review &rarr;</span>
                      </button>
                    )}
                    {stats.disputesOpen > 0 && (
                      <button onClick={() => setActiveTab("disputes")} className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm transition hover:shadow-sm">
                        <span className="text-gray-700"><strong>{stats.disputesOpen}</strong> open dispute{stats.disputesOpen !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-red-600">Resolve &rarr;</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Conversion Funnel */}
              <div className="mt-6 rounded-xl border border-warm-200 bg-white p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-900">Conversion Funnel</h3>
                <div className="mt-4 space-y-2">
                  {(() => {
                    const steps = [
                      { label: "Messaged", value: stats.funnelMessages, color: "bg-blue-500" },
                      { label: "Booked", value: stats.funnelBookings, color: "bg-indigo-500" },
                      { label: "Paid", value: stats.funnelPaid, color: "bg-purple-500" },
                      { label: "Delivered", value: stats.funnelDelivered, color: "bg-amber-500" },
                      { label: "Accepted", value: stats.funnelAccepted, color: "bg-green-500" },
                      { label: "Reviewed", value: stats.funnelReviewed, color: "bg-primary-500" },
                    ];
                    const max = Math.max(...steps.map(s => s.value), 1);
                    return steps.map((step, i) => {
                      const pct = Math.round((step.value / max) * 100);
                      const convRate = i > 0 && steps[i - 1].value > 0
                        ? Math.round((step.value / steps[i - 1].value) * 100)
                        : null;
                      return (
                        <div key={step.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{step.label}</span>
                            <span className="font-semibold text-gray-900">
                              {step.value}
                              {convRate !== null && (
                                <span className={`ml-1.5 font-normal ${convRate >= 50 ? "text-green-600" : convRate >= 25 ? "text-amber-600" : "text-red-500"}`}>
                                  ({convRate}%)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Upcoming Events */}
              <UpcomingEvents onNavigate={() => setActiveTab("calendar")} />

              {/* Revenue Charts */}
              <RevenueCharts />
            </div>
          )}
          {activeTab === "photographers" && photographersSection}
          {activeTab === "clients" && clientsSection}
          {activeTab === "calendar" && <AdminCalendarTab />}
          {activeTab === "bookings" && bookingsSection}
          {activeTab === "inquiries" && inquiriesSection}
          {activeTab === "matchRequests" && matchRequestsSection}
          {activeTab === "concierge" && <AdminConciergeTab />}
          {activeTab === "popupStats" && <AdminPopupStats />}
          {activeTab === "visitors" && visitorsSection}
          {activeTab === "disputes" && disputesSection}
          {activeTab === "reviews" && reviewsSection}
          {activeTab === "blog" && blogSection}
          {activeTab === "promos" && promosSection}
          {activeTab === "locations" && locationsSection}
          {activeTab === "redirects" && <RedirectsManager />}
          {activeTab === "logs" && (
            <div>
              <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
                {([
                  { key: "sms" as LogSubTab, label: "SMS" },
                  { key: "email" as LogSubTab, label: "Email" },
                  { key: "telegram" as LogSubTab, label: "Telegram" },
                  { key: "queue" as LogSubTab, label: "Queue" },
                  { key: "audit" as LogSubTab, label: "System" },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setLogTab(t.key)}
                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      logSubTab === t.key
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-white border border-warm-200 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {logSubTab === "audit" && <AuditLogTab />}
              {logSubTab === "email" && <NotificationLogsTab channel="email" title="Email Logs" />}
              {logSubTab === "sms" && <NotificationLogsTab channel="sms" title="SMS Logs" />}
              {logSubTab === "telegram" && <NotificationLogsTab channel="telegram" title="Telegram Logs" />}
              {logSubTab === "queue" && <NotificationQueueTab />}
            </div>
          )}
          {activeTab === "settings" && settingsSection}
          </>}
        </div>
      </div>
      <AdminToastProvider />
    </div>
  );
}
