"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

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

interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
}

const tabs: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
  },
  {
    id: "photographers",
    label: "Photographers",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />,
  },
  {
    id: "clients",
    label: "Clients",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />,
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  },
  {
    id: "blog",
    label: "Blog",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />,
  },
  {
    id: "promos",
    label: "Promo Codes",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />,
  },
  {
    id: "locations",
    label: "Locations",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
  },
];

function StatCard({ value, label, sublabel, color = "text-primary-600" }: { value: string | number; label: string; sublabel?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-warm-200 bg-white p-5">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>
      {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
    </div>
  );
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
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex min-h-screen bg-warm-50">
      {/* Sidebar */}
      <aside className="sticky top-0 h-screen w-56 shrink-0 border-r border-warm-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-warm-200">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white text-xs font-bold">PP</div>
            <span className="font-display text-sm font-bold text-gray-900">Admin Panel</span>
          </Link>
        </div>
        <nav className="p-2 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-warm-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {tab.icon}
              </svg>
              {tab.label}
              {tab.id === "photographers" && stats.photographersPending > 0 && (
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  {stats.photographersPending}
                </span>
              )}
              {tab.id === "bookings" && stats.bookingsPending > 0 && (
                <span className="ml-auto rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                  {stats.bookingsPending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-warm-200 p-3">
          {logoutButton}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {/* Overview */}
        {activeTab === "overview" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="mt-1 text-sm text-gray-500">Platform metrics at a glance</p>

            {/* Key metrics */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard value={stats.photographersApproved} label="Photographers" sublabel={stats.photographersPending > 0 ? `${stats.photographersPending} pending approval` : "All approved"} />
              <StatCard value={stats.clients} label="Clients" sublabel="Registered accounts" />
              <StatCard value={`\u20ac${stats.revenue.toLocaleString()}`} label="Total Revenue" sublabel={`\u20ac${stats.revenueThisMonth.toLocaleString()} this month`} color="text-accent-600" />
              <StatCard value={stats.reviews} label="Reviews" sublabel={`${stats.messages} messages sent`} />
            </div>

            {/* Booking breakdown */}
            <h2 className="mt-8 text-lg font-bold text-gray-900">Bookings</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard value={stats.bookingsTotal} label="Total Bookings" />
              <StatCard value={stats.bookingsPending} label="Pending" color="text-yellow-600" />
              <StatCard value={stats.bookingsConfirmed} label="Confirmed" color="text-blue-600" />
              <StatCard value={stats.bookingsCompleted} label="Completed" color="text-accent-600" />
            </div>

            {/* Quick actions */}
            <h2 className="mt-8 text-lg font-bold text-gray-900">Quick Actions</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                { label: "Manage Photographers", tab: "photographers" },
                { label: "View Bookings", tab: "bookings" },
                { label: "Write Blog Post", tab: "blog" },
                { label: "Create Promo Code", tab: "promos" },
              ].map((action) => (
                <button
                  key={action.tab}
                  onClick={() => setActiveTab(action.tab)}
                  className="rounded-lg border border-warm-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:text-primary-600"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "photographers" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Photographers</h1>
            <p className="mt-1 text-sm text-gray-500">Manage photographer profiles, approval, and plans</p>
            <div className="mt-6">{photographersSection}</div>
          </div>
        )}

        {activeTab === "clients" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Clients</h1>
            <p className="mt-1 text-sm text-gray-500">Registered client accounts</p>
            <div className="mt-6">{clientsSection}</div>
          </div>
        )}

        {activeTab === "bookings" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="mt-1 text-sm text-gray-500">Recent booking activity</p>
            <div className="mt-6">{bookingsSection}</div>
          </div>
        )}

        {activeTab === "blog" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Blog</h1>
            <p className="mt-1 text-sm text-gray-500">Manage blog posts and content</p>
            <div className="mt-6">{blogSection}</div>
          </div>
        )}

        {activeTab === "promos" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Promo Codes</h1>
            <p className="mt-1 text-sm text-gray-500">Manage discount codes and promotions</p>
            <div className="mt-6">{promosSection}</div>
          </div>
        )}

        {activeTab === "locations" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Locations</h1>
            <p className="mt-1 text-sm text-gray-500">Manage photoshoot locations</p>
            <div className="mt-6">{locationsSection}</div>
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Platform configuration</p>
            <div className="mt-6">{settingsSection}</div>
          </div>
        )}
      </main>
    </div>
  );
}
