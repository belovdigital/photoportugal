"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  badge?: number;
  roles: string[];
}

export function DashboardSidebar({ initialRole }: { initialRole?: string }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const sessionRole = (session?.user as { role?: string })?.role;
  const role = sessionRole || (status === "loading" ? initialRole : undefined) || initialRole || "client";
  const notifications = useNotifications();
  const t = useTranslations("dashboard");

  const navItems: NavItem[] = [
    { href: "/dashboard", labelKey: "sidebarOverview", icon: "home", roles: ["photographer"] },
    { href: "/dashboard/bookings", labelKey: "sidebarBookings", icon: "calendar", roles: ["client", "photographer"], badge: notifications.pending_bookings },
    { href: "/dashboard/match-requests", labelKey: "sidebarMatchRequests", icon: "search", roles: ["client"] },
    { href: "/dashboard/messages", labelKey: "sidebarMessages", icon: "chat", roles: ["client", "photographer"], badge: notifications.unread_messages },
    { href: "/dashboard/profile", labelKey: "sidebarProfile", icon: "user", roles: ["photographer"] },
    { href: "/dashboard/portfolio", labelKey: "sidebarPortfolio", icon: "image", roles: ["photographer"] },
    { href: "/dashboard/packages", labelKey: "sidebarPackages", icon: "package", roles: ["photographer"] },
    { href: "/dashboard/availability", labelKey: "sidebarAvailability", icon: "clock", roles: ["photographer"] },
    { href: "/dashboard/subscriptions", labelKey: "sidebarSubscriptions", icon: "credit-card", roles: ["photographer"] },
    { href: "/dashboard/payouts", labelKey: "sidebarPayouts", icon: "banknotes", roles: ["photographer"] },
    { href: "/dashboard/settings", labelKey: "sidebarSettings", icon: "settings", roles: ["client", "photographer"] },
    { href: "/dashboard/support", labelKey: "sidebarSupport", icon: "help-circle", roles: ["photographer"] },
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Sidebar — desktop only. Mobile uses DashboardMobileNav. */}
      <aside className="sticky top-[100px] hidden h-auto w-56 shrink-0 bg-transparent md:block" style={{ maxHeight: "calc(100dvh - 100px)" }}>
        <nav className="flex flex-col gap-0.5 p-3">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.endsWith(item.href) || (item.href !== "/dashboard" && pathname.includes(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-3">
                  <SidebarIcon type={item.icon} active={isActive} />
                  {t(item.labelKey)}
                </span>
                {item.badge && item.badge > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {role === "photographer" && (
            <ViewPublicProfileLink />
          )}
        </nav>

      </aside>
    </>
  );
}

function ViewPublicProfileLink() {
  const [data, setData] = useState<{ slug: string; is_approved: boolean } | null>(null);
  const t = useTranslations("dashboard");

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then(r => r.json())
      .then(d => { if (d.slug) setData({ slug: d.slug, is_approved: !!d.is_approved }); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const label = data.is_approved ? t("viewPublicProfile") : t("previewProfile");

  return (
    <a
      href={`/photographers/${data.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      title={data.is_approved ? undefined : t("previewProfileHint")}
      className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:border-primary-300 hover:text-primary-600"
    >
      <svg className="h-4.5 w-4.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {data.is_approved ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        ) : (
          <>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </>
        )}
      </svg>
      {label}
    </a>
  );
}

function SidebarIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `h-4.5 w-4.5 ${active ? "text-primary-600" : "text-gray-400"}`;

  switch (type) {
    case "home":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case "calendar":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "chat":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "user":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case "image":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "package":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case "clock":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "credit-card":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
    case "banknotes":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" /><circle cx="12" cy="12" r="3" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 9h2m16 0h2M2 15h2m16 0h2" /></svg>;
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "search":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "help-circle":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    default:
      return null;
  }
}
