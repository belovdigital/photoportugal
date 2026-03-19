"use client";

import { useState, useEffect, type ReactNode } from "react";

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
  disputesOpen: number;
  // Funnel
  funnelMessages: number;
  funnelBookings: number;
  funnelPaid: number;
  funnelDelivered: number;
  funnelAccepted: number;
  funnelReviewed: number;
}

const tabs = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "photographers", label: "Photographers", icon: "camera" },
  { key: "clients", label: "Clients", icon: "users" },
  { key: "bookings", label: "Bookings", icon: "calendar" },
  { key: "disputes", label: "Disputes", icon: "flag" },
  { key: "reviews", label: "Reviews", icon: "star" },
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
    case "flag":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>;
    case "star":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
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
  analyticsSection,
  photographersSection,
  clientsSection,
  bookingsSection,
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
  disputesSection: ReactNode;
  reviewsSection: ReactNode;
  blogSection: ReactNode;
  promosSection: ReactNode;
  locationsSection: ReactNode;
  settingsSection: ReactNode;
}) {
  const [activeTab, setActiveTabState] = useState<TabKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persist tab in URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1) as TabKey;
    if (hash && tabs.some((t) => t.key === hash)) {
      setActiveTabState(hash);
    }
  }, []);

  function setActiveTab(tab: TabKey) {
    setActiveTabState(tab);
    window.history.replaceState(null, "", `#${tab}`);
  }

  function getBadge(key: string): number {
    if (key === "photographers") return stats.photographersPending;
    if (key === "bookings") return stats.bookingsPending;
    if (key === "disputes") return stats.disputesOpen;
    return 0;
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 sm:px-8">
      {/* Header — full width above sidebar */}
      <div className="flex items-center justify-between pt-6 sm:pt-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-gray-500">Platform overview and management</p>
        </div>
        {logoutButton}
      </div>

      <div className="mt-6 flex min-h-[calc(100vh-200px)]">
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

        {/* Sidebar */}
        <aside className={`
          fixed left-0 top-0 z-30 h-full w-56 shrink-0 bg-warm-50 pt-[100px] transition-transform
          md:sticky md:top-0 md:h-auto md:translate-x-0 md:bg-transparent md:pt-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <nav className="flex flex-col gap-0.5 pr-3">
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
        <div className="flex-1 min-w-0 pl-8">
          {activeTab === "analytics" && analyticsSection}
          {activeTab === "overview" && (
            <div>
              {/* Key metrics — 2 rows */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-warm-200 bg-white p-5">
                  <p className="text-sm font-medium text-gray-500">Revenue</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">&euro;{stats.revenue.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-400">&euro;{stats.revenueThisMonth.toLocaleString()} this month</p>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-5">
                  <p className="text-sm font-medium text-gray-500">Bookings</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{stats.bookingsTotal}</p>
                  <div className="mt-1 flex gap-2 text-xs">
                    {stats.bookingsPending > 0 && <span className="text-yellow-600">{stats.bookingsPending} pending</span>}
                    {stats.bookingsConfirmed > 0 && <span className="text-blue-600">{stats.bookingsConfirmed} confirmed</span>}
                    {stats.bookingsCompleted > 0 && <span className="text-green-600">{stats.bookingsCompleted} done</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-5">
                  <p className="text-sm font-medium text-gray-500">Photographers</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{stats.photographersApproved}</p>
                  {stats.photographersPending > 0 && <p className="mt-1 text-xs text-yellow-600">{stats.photographersPending} awaiting approval</p>}
                </div>
                <div className="rounded-xl border border-warm-200 bg-white p-5">
                  <p className="text-sm font-medium text-gray-500">Clients</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{stats.clients}</p>
                  <p className="mt-1 text-xs text-gray-400">{stats.reviews} reviews &middot; {stats.disputesOpen > 0 ? <span className="text-red-500">{stats.disputesOpen} disputes</span> : "0 disputes"}</p>
                </div>
              </div>

              {/* Action items — what needs attention */}
              {(stats.bookingsPending > 0 || stats.photographersPending > 0 || stats.disputesOpen > 0) && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-800">Needs Attention</h3>
                  <div className="mt-3 space-y-2">
                    {stats.bookingsPending > 0 && (
                      <button onClick={() => setActiveTab("bookings")} className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm transition hover:shadow-sm">
                        <span className="text-gray-700"><strong>{stats.bookingsPending}</strong> booking{stats.bookingsPending !== 1 ? "s" : ""} waiting for response</span>
                        <span className="text-xs text-primary-600">View &rarr;</span>
                      </button>
                    )}
                    {stats.photographersPending > 0 && (
                      <button onClick={() => setActiveTab("photographers")} className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm transition hover:shadow-sm">
                        <span className="text-gray-700"><strong>{stats.photographersPending}</strong> photographer{stats.photographersPending !== 1 ? "s" : ""} awaiting approval</span>
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

              {/* Quick navigation */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Analytics", sub: "Traffic & search data", icon: "chart", tab: "analytics" as TabKey },
                  { label: "Bookings", sub: "Manage requests", icon: "calendar", tab: "bookings" as TabKey },
                  { label: "Blog", sub: `${stats.messages > 0 ? "34" : "0"} posts`, icon: "document", tab: "blog" as TabKey },
                  { label: "Promo Codes", sub: "Create discounts", icon: "tag", tab: "promos" as TabKey },
                ].map((action) => (
                  <button
                    key={action.tab}
                    onClick={() => setActiveTab(action.tab)}
                    className="flex items-center gap-3 rounded-xl border border-warm-200 bg-white p-4 text-left transition hover:border-primary-200 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warm-100">
                      <SidebarIcon type={action.icon} active={false} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                      <p className="text-[11px] text-gray-400">{action.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTab === "photographers" && photographersSection}
          {activeTab === "clients" && clientsSection}
          {activeTab === "bookings" && bookingsSection}
          {activeTab === "disputes" && disputesSection}
          {activeTab === "reviews" && reviewsSection}
          {activeTab === "blog" && blogSection}
          {activeTab === "promos" && promosSection}
          {activeTab === "locations" && locationsSection}
          {activeTab === "settings" && settingsSection}
        </div>
      </div>
    </div>
  );
}
