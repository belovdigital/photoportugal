"use client";

import { useState, type ReactNode } from "react";

interface AdminStats {
  clients: number;
  photographersApproved: number;
  photographersPending: number;
  bookingsTotal: number;
  bookingsPending: number;
  bookingsConfirmed: number;
  bookingsCompleted: number;
  revenue: number;
  revenueThisMonth: number;
  reviews: number;
  messages: number;
}

const tabs = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "photographers", label: "Photographers", icon: "camera" },
  { key: "clients", label: "Clients", icon: "users" },
  { key: "bookings", label: "Bookings", icon: "calendar" },
  { key: "blog", label: "Blog", icon: "document" },
  { key: "promos", label: "Promo Codes", icon: "tag" },
  { key: "locations", label: "Locations", icon: "map" },
  { key: "settings", label: "Settings", icon: "settings" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function SidebarIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `h-4.5 w-4.5 ${active ? "text-primary-600" : "text-gray-400"}`;
  switch (type) {
    case "home":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
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
    case "map":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    default:
      return null;
  }
}

export function AdminDashboard({
  stats,
  logoutButton,
  photographersSection,
  clientsSection,
  bookingsSection,
  blogSection,
  promosSection,
  locationsSection,
  settingsSection,
}: {
  stats: AdminStats;
  logoutButton: ReactNode;
  photographersSection: ReactNode;
  clientsSection: ReactNode;
  bookingsSection: ReactNode;
  blogSection: ReactNode;
  promosSection: ReactNode;
  locationsSection: ReactNode;
  settingsSection: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function getBadge(key: string): number {
    if (key === "photographers") return stats.photographersPending;
    if (key === "bookings") return stats.bookingsPending;
    return 0;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] max-w-screen-xl">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg md:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — same style as DashboardSidebar */}
      <aside className={`
        fixed left-0 top-0 z-30 h-full w-56 shrink-0 bg-warm-50 pt-[100px] transition-transform
        md:sticky md:top-[100px] md:h-auto md:translate-x-0 md:bg-transparent md:pt-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `} style={{ maxHeight: "calc(100vh - 100px)" }}>
        <nav className="flex flex-col gap-0.5 p-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = getBadge(tab.key);

            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
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
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-1 text-gray-500">Platform overview and management</p>
          </div>
          {logoutButton}
        </div>

        {/* Content by tab */}
        <div className="mt-6">
          {activeTab === "overview" && (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Photographers", value: stats.photographersApproved, sub: stats.photographersPending > 0 ? `${stats.photographersPending} pending` : undefined },
                  { label: "Clients", value: stats.clients },
                  { label: "Bookings", value: stats.bookingsTotal, sub: stats.bookingsPending > 0 ? `${stats.bookingsPending} pending` : undefined },
                  { label: "Revenue", value: `\u20ac${stats.revenue.toLocaleString()}`, sub: `\u20ac${stats.revenueThisMonth.toLocaleString()} this month` },
                  { label: "Reviews", value: stats.reviews },
                  { label: "Messages", value: stats.messages },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    {stat.sub && <p className="text-xs text-gray-400">{stat.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Booking breakdown */}
              <h2 className="mt-8 text-lg font-bold text-gray-900">Booking Breakdown</h2>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total", value: stats.bookingsTotal },
                  { label: "Pending", value: stats.bookingsPending },
                  { label: "Confirmed", value: stats.bookingsConfirmed },
                  { label: "Completed", value: stats.bookingsCompleted },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <h2 className="mt-8 text-lg font-bold text-gray-900">Quick Actions</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: "Bookings", sub: "View and manage requests", icon: "calendar", tab: "bookings" as TabKey },
                  { label: "Blog", sub: "Write a new post", icon: "document", tab: "blog" as TabKey },
                  { label: "Promo Codes", sub: "Create discount codes", icon: "tag", tab: "promos" as TabKey },
                ].map((action) => (
                  <button
                    key={action.tab}
                    onClick={() => setActiveTab(action.tab)}
                    className="flex items-start gap-4 rounded-xl border border-warm-200 bg-white p-5 text-left transition hover:border-primary-200 hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warm-100">
                      <SidebarIcon type={action.icon} active={false} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{action.label}</p>
                      <p className="text-xs text-gray-500">{action.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTab === "photographers" && photographersSection}
          {activeTab === "clients" && clientsSection}
          {activeTab === "bookings" && bookingsSection}
          {activeTab === "blog" && blogSection}
          {activeTab === "promos" && promosSection}
          {activeTab === "locations" && locationsSection}
          {activeTab === "settings" && settingsSection}
        </div>
      </div>
    </div>
  );
}
