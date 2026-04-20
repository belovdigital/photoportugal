"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTranslations } from "next-intl";

interface TabItem {
  href: string;
  labelKey: string;
  icon: string;
  badgeKey?: "pending_bookings" | "unread_messages";
}

interface MoreItem {
  href: string;
  labelKey: string;
  icon: string;
  external?: boolean;
}

const PHOTOGRAPHER_TABS: TabItem[] = [
  { href: "/dashboard", labelKey: "sidebarOverview", icon: "home" },
  { href: "/dashboard/bookings", labelKey: "sidebarBookings", icon: "calendar", badgeKey: "pending_bookings" },
  { href: "/dashboard/messages", labelKey: "sidebarMessages", icon: "chat", badgeKey: "unread_messages" },
  { href: "/dashboard/profile", labelKey: "sidebarProfile", icon: "user" },
];

const PHOTOGRAPHER_MORE: MoreItem[] = [
  { href: "/dashboard/portfolio", labelKey: "sidebarPortfolio", icon: "image" },
  { href: "/dashboard/packages", labelKey: "sidebarPackages", icon: "package" },
  { href: "/dashboard/availability", labelKey: "sidebarAvailability", icon: "clock" },
  { href: "/dashboard/subscriptions", labelKey: "sidebarSubscriptions", icon: "credit-card" },
  { href: "/dashboard/payouts", labelKey: "sidebarPayouts", icon: "banknotes" },
  { href: "/dashboard/settings", labelKey: "sidebarSettings", icon: "settings" },
  { href: "/dashboard/support", labelKey: "sidebarSupport", icon: "help-circle" },
];

const CLIENT_TABS: TabItem[] = [
  { href: "/dashboard/bookings", labelKey: "sidebarBookings", icon: "calendar", badgeKey: "pending_bookings" },
  { href: "/dashboard/match-requests", labelKey: "sidebarMatchRequests", icon: "search" },
  { href: "/dashboard/messages", labelKey: "sidebarMessages", icon: "chat", badgeKey: "unread_messages" },
  { href: "/dashboard/wishlist", labelKey: "sidebarWishlist", icon: "heart" },
];

const CLIENT_MORE: MoreItem[] = [
  { href: "/dashboard/settings", labelKey: "sidebarSettings", icon: "settings" },
];

export function DashboardMobileNav({ initialRole }: { initialRole?: string }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const sessionRole = (session?.user as { role?: string })?.role;
  const role = sessionRole || (status === "loading" ? initialRole : undefined) || initialRole || "client";
  const notifications = useNotifications();
  const t = useTranslations("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [moreOpen]);

  const tabs = role === "photographer" ? PHOTOGRAPHER_TABS : CLIENT_TABS;
  const more = role === "photographer" ? PHOTOGRAPHER_MORE : CLIENT_MORE;

  // Hide on messages chat detail page (conflicts with sticky send bar)
  const isChatDetail = /\/dashboard\/messages\/[^/]+/.test(pathname);
  if (isChatDetail) return null;

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname.endsWith("/dashboard");
    return pathname === href || pathname.startsWith(href + "/") || pathname.endsWith(href);
  }

  function badgeFor(key?: "pending_bookings" | "unread_messages") {
    if (!key) return 0;
    return notifications[key] || 0;
  }

  const isMoreActive = more.some((m) => isActive(m.href));

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-warm-200 bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const badge = badgeFor(tab.badgeKey);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                active ? "text-primary-600" : "text-gray-500"
              }`}
            >
              <NavIcon type={tab.icon} active={active} />
              <span className="leading-none">{t(tab.labelKey)}</span>
              {badge > 0 && (
                <span className="absolute right-[calc(50%-18px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
            isMoreActive ? "text-primary-600" : "text-gray-500"
          }`}
        >
          <NavIcon type="dots" active={isMoreActive} />
          <span className="leading-none">{t("sidebarMore")}</span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-900">{t("sidebarMore")}</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-warm-50 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {more.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      active ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-warm-50"
                    }`}
                  >
                    <NavIcon type={item.icon} active={active} />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              {role === "photographer" && <MoreViewPublicProfileLink onClick={() => setMoreOpen(false)} />}
              <button
                onClick={() => { setMoreOpen(false); signOut({ callbackUrl: "/" }); }}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-500 transition hover:bg-warm-50"
              >
                <NavIcon type="logout" active={false} />
                {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MoreViewPublicProfileLink({ onClick }: { onClick: () => void }) {
  const [data, setData] = useState<{ slug: string; is_approved: boolean } | null>(null);
  const t = useTranslations("dashboard");

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then(r => r.json())
      .then(d => { if (d.slug) setData({ slug: d.slug, is_approved: !!d.is_approved }); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <a
      href={`/photographers/${data.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 transition hover:bg-warm-50"
    >
      <NavIcon type="external" active={false} />
      {data.is_approved ? t("viewPublicProfile") : t("previewProfile")}
    </a>
  );
}

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `h-5 w-5 ${active ? "text-primary-600" : "text-gray-400"}`;
  switch (type) {
    case "home":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case "calendar":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "chat":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "user":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case "image":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "package":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case "clock":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "credit-card":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
    case "banknotes":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" /><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 9h2m16 0h2M2 15h2m16 0h2" /></svg>;
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "search":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case "heart":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
    case "help-circle":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "dots":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" /></svg>;
    case "external":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
    case "logout":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    default:
      return null;
  }
}
