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
  { key: "overview", label: "Overview" },
  { key: "photographers", label: "Photographers" },
  { key: "clients", label: "Clients" },
  { key: "bookings", label: "Bookings" },
  { key: "blog", label: "Blog" },
  { key: "promos", label: "Promo Codes" },
  { key: "locations", label: "Locations" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

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

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-gray-500">Platform overview and management</p>
        </div>
        {logoutButton}
      </div>

      {/* Stats row — always visible */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Photographers", value: stats.photographersApproved, sub: stats.photographersPending > 0 ? `${stats.photographersPending} pending` : undefined, color: "text-primary-600" },
          { label: "Clients", value: stats.clients, color: "text-primary-600" },
          { label: "Bookings", value: stats.bookingsTotal, sub: stats.bookingsPending > 0 ? `${stats.bookingsPending} pending` : undefined, color: "text-primary-600" },
          { label: "Revenue", value: `\u20ac${stats.revenue.toLocaleString()}`, sub: `\u20ac${stats.revenueThisMonth.toLocaleString()} this month`, color: "text-accent-600" },
          { label: "Reviews", value: stats.reviews, color: "text-primary-600" },
          { label: "Messages", value: stats.messages, color: "text-primary-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs font-medium text-gray-500">{stat.label}</p>
            {stat.sub && <p className="text-[10px] text-gray-400">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-8 overflow-x-auto border-b border-warm-200">
        <div className="flex gap-6 whitespace-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 pb-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.key === "photographers" && stats.photographersPending > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">{stats.photographersPending}</span>
              )}
              {tab.key === "bookings" && stats.bookingsPending > 0 && (
                <span className="ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">{stats.bookingsPending}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-8">
        {activeTab === "overview" && (
          <div>
            <h2 className="text-lg font-bold text-gray-900">Booking Breakdown</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total", value: stats.bookingsTotal, color: "text-gray-900" },
                { label: "Pending", value: stats.bookingsPending, color: "text-yellow-600" },
                { label: "Confirmed", value: stats.bookingsConfirmed, color: "text-blue-600" },
                { label: "Completed", value: stats.bookingsCompleted, color: "text-accent-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
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
  );
}
