"use client";

import { Link } from "@/i18n/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { unsplashUrl } from "@/lib/unsplash-images";
import { locations } from "@/lib/locations-data";
import { useNotifications } from "@/contexts/NotificationContext";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Avatar } from "@/components/ui/Avatar";

const TOP_DESTINATIONS = [
  { slug: "lisbon", name: "Lisbon", img: "photo-1536663060084-a0d9eeeaf44b" },
  { slug: "porto", name: "Porto", img: "photo-1756765786971-384a44daf35d" },
  { slug: "algarve", name: "Algarve", img: "photo-1560242374-7befcc667b39" },
  { slug: "sintra", name: "Sintra", img: "photo-1697394494123-c6c1323a14f7" },
  { slug: "madeira", name: "Madeira", img: "photo-1721241843813-c54b77496005" },
  { slug: "azores", name: "Azores", img: "photo-1542575749037-7ef4545e897d" },
];

const SHOOT_TYPES_DATA = [
  { key: "couples", href: "/photographers?shoot=Couples" },
  { key: "family", href: "/photographers?shoot=Family" },
  { key: "soloPortrait", href: "/photographers?shoot=Solo+Portrait" },
  { key: "engagement", href: "/photographers?shoot=Engagement" },
  { key: "proposal", href: "/photographers?shoot=Proposal" },
  { key: "honeymoon", href: "/photographers?shoot=Honeymoon" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const isPhotographer = role === "photographer";
  const isLoading = status === "loading";
  const notifications = useNotifications();
  useEffect(() => {
    setMobileOpen(false);
    setActiveMenu(null);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleMenu(menu: string) {
    setActiveMenu(activeMenu === menu ? null : menu);
  }

  function switchLocale() {
    const newLocale = locale === "en" ? "pt" : "en";
    const currentPath = window.location.pathname;
    const cleanPath = currentPath.replace(/^\/pt(\/|$)/, "/").replace(/\/+$/, "") || "/";
    const newPath = newLocale === "pt" ? `/pt${cleanPath === "/" ? "" : cleanPath}` : cleanPath;
    window.location.href = newPath;
  }

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-gray-900 text-center text-xs sm:text-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
          <p className="text-gray-300">
            <span className="text-white font-semibold">{t("announcement")}</span> {t("announcementSuffix", { count: locations.length })}
            <Link href="/photographers" className="ml-2 text-primary-400 hover:text-primary-300 font-medium">
              {t("browseNow")}
            </Link>
          </p>
        </div>
      </div>

      {/* Main header */}
      <header className="md:sticky md:top-0 z-50 border-b border-warm-200 bg-white/95 md:backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="shrink-0" onClick={() => setActiveMenu(null)}>
            <img src="/logo.svg" alt="Photo Portugal" width={140} height={28} className="h-7 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex" ref={menuRef}>
            {/* Destinations dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleMenu("destinations")}
                aria-expanded={activeMenu === "destinations"}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMenu === "destinations" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
                }`}
              >
                {t("destinations")}
                <svg className={`h-3.5 w-3.5 transition ${activeMenu === "destinations" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMenu === "destinations" && (
                <div className="absolute left-0 top-full mt-2 w-[640px] rounded-xl border border-warm-200 bg-white p-5 shadow-xl">
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("popularDestinations")}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {TOP_DESTINATIONS.map((d) => (
                          <Link key={d.slug} href={`/locations/${d.slug}`} onClick={() => setActiveMenu(null)} className="group overflow-hidden rounded-lg">
                            <div className="relative aspect-[4/3]">
                              <OptimizedImage src={unsplashUrl(d.img, 200, 70)} alt={d.name} className="h-full w-full transition group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <p className="absolute bottom-1.5 left-2 text-xs font-semibold text-white">{d.name}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <Link href="/locations" onClick={() => setActiveMenu(null)} className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:text-primary-700">
                        {t("allLocations", { count: 25 })}
                      </Link>
                    </div>
                    <div className="w-40 shrink-0 border-l border-warm-100 pl-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("byOccasion")}</p>
                      <div className="mt-3 space-y-0.5">
                        {SHOOT_TYPES_DATA.map((s) => (
                          <Link key={s.key} href={s.href} onClick={() => setActiveMenu(null)}
                            className="block rounded-lg px-2 py-1.5 text-sm text-gray-600 transition hover:bg-primary-50 hover:text-primary-600">
                            {t(`shootTypes.${s.key}`)}
                          </Link>
                        ))}
                      </div>
                      <Link href="/photographers" onClick={() => setActiveMenu(null)}
                        className="mt-2 block text-xs font-semibold text-primary-600 hover:text-primary-700 px-2">
                        {t("allTypes")}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="/photographers" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:text-primary-600">
              {t("photographers")}
            </Link>

            {/* For Clients dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleMenu("forClients")}
                aria-expanded={activeMenu === "forClients"}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMenu === "forClients" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
                }`}
              >
                {t("forClients")}
                <svg className={`h-3.5 w-3.5 transition ${activeMenu === "forClients" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMenu === "forClients" && (
                <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-warm-200 bg-white p-4 shadow-xl">
                  <div className="space-y-0.5">
                    <Link href="/how-it-works" onClick={() => setActiveMenu(null)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <svg className="h-4.5 w-4.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t("howItWorks")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsHowItWorksDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/faq" onClick={() => setActiveMenu(null)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <svg className="h-4.5 w-4.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t("faq")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsFaqDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/how-we-select" onClick={() => setActiveMenu(null)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <svg className="h-4.5 w-4.5 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t("howWeSelect")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsHowWeSelectDesc")}</p>
                      </div>
                    </Link>
                    <div className="my-1.5 border-t border-warm-100" />
                    <Link href="/about" onClick={() => setActiveMenu(null)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <svg className="h-4.5 w-4.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-sm text-gray-600">{t("about")}</p>
                    </Link>
                    <Link href="/contact" onClick={() => setActiveMenu(null)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <svg className="h-4.5 w-4.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <p className="text-sm text-gray-600">{t("contact")}</p>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {!isLoading && (!user || role === "photographer") && <div className="relative">
              <button
                onClick={() => toggleMenu("photographers")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMenu === "photographers" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
                }`}
              >
                {t("forPhotographers")}
                <svg className={`h-3.5 w-3.5 transition ${activeMenu === "photographers" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMenu === "photographers" && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-warm-200 bg-white p-5 shadow-xl">
                  <p className="text-sm font-semibold text-gray-900">{t("becomePhotographer")}</p>
                  <p className="mt-1 text-xs text-gray-500">{t("becomePhotographerDesc")}</p>
                  <div className="mt-4 space-y-1">
                    <Link href="/join" onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      {t("joinAsPhotographer")}
                    </Link>
                    <Link href="/pricing" onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {t("pricingPlans")}
                    </Link>
                    <Link href="/for-photographers" onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600">
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {t("learnMore")}
                    </Link>
                  </div>
                </div>
              )}
            </div>}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex items-center overflow-hidden rounded-lg border border-warm-200 text-xs font-bold">
              <button
                onClick={() => { if (locale !== "en") switchLocale(); }}
                className={`px-2 py-1.5 transition ${locale === "en" ? "bg-primary-600 text-white" : "text-gray-400 hover:bg-warm-50 hover:text-gray-700"}`}
              >
                EN
              </button>
              <button
                onClick={() => { if (locale !== "pt") switchLocale(); }}
                className={`px-2 py-1.5 transition ${locale === "pt" ? "bg-primary-600 text-white" : "text-gray-400 hover:bg-warm-50 hover:text-gray-700"}`}
              >
                PT
              </button>
            </div>

            {/* Book CTA — hide while loading to prevent flash */}
            {!isLoading && !isPhotographer && (
              <Link href="/photographers" className="hidden rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 sm:inline-flex">
                {t("bookPhotoshoot")}
              </Link>
            )}

            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="hidden h-8 w-20 animate-pulse rounded-lg bg-warm-200 sm:block" />
                <div className="h-8 w-8 animate-pulse rounded-full bg-warm-200" />
              </div>
            ) : user ? (
              <div className="flex items-center gap-1">
                <Link href="/dashboard/bookings" aria-label={t("bookings")} className="relative rounded-lg p-2 text-gray-500 transition hover:bg-warm-50 hover:text-gray-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {notifications.pending_bookings > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                      {notifications.pending_bookings}
                    </span>
                  )}
                </Link>

                <Link href="/dashboard/messages" aria-label={t("messages")} className="relative rounded-lg p-2 text-gray-500 transition hover:bg-warm-50 hover:text-gray-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {notifications.unread_messages > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {notifications.unread_messages}
                    </span>
                  )}
                </Link>

                <div className="relative" ref={profileRef}>
                  <button onClick={() => setProfileOpen(!profileOpen)} aria-label={t("accountMenu")} className="flex items-center rounded-full p-1 transition hover:bg-warm-50">
                    {user.image ? (
                      <Avatar src={user.image} fallback={user.name ?? "U"} size="sm" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                        {user.name?.charAt(0) ?? "U"}
                      </div>
                    )}
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-warm-200 bg-white shadow-lg">
                      <div className="border-b border-warm-100 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <DropdownLink href="/dashboard" icon="grid" label={t("dashboard")} onClick={() => setProfileOpen(false)} />
                        {isPhotographer && (
                          <DropdownLink href="/dashboard/profile" icon="user" label={t("myProfile")} onClick={() => setProfileOpen(false)} />
                        )}
                        <DropdownLink href="/dashboard/settings" icon="settings" label={t("settings")} onClick={() => setProfileOpen(false)} />
                        {role === "admin" && (
                          <DropdownLink href="/admin" icon="grid" label="Admin Panel" onClick={() => setProfileOpen(false)} />
                        )}
                      </div>
                      <div className="border-t border-warm-100 py-1">
                        <button
                          onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/" }); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-500 transition hover:bg-warm-50"
                        >
                          <DropdownIcon type="logout" />
                          {t("signOut")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Link href="/auth/signin" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
                {t("logIn")}
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-gray-600 lg:hidden"
              aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-warm-200 bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              <MobileNavLink href="/photographers" label={t("findPhotographers")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/locations" label={t("allDestinations")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/how-it-works" label={t("howItWorks")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/faq" label={t("faq")} onClick={() => setMobileOpen(false)} />
              {!isLoading && !user && (
                <>
                  <hr className="my-2 border-warm-200" />
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{t("forPhotographers")}</p>
                  <MobileNavLink href="/join" label={t("joinAsPhotographer")} onClick={() => setMobileOpen(false)} />
                  <MobileNavLink href="/pricing" label={t("pricingPlans")} onClick={() => setMobileOpen(false)} />
                </>
              )}
              <hr className="my-2 border-warm-200" />
              {user ? (
                <>
                  <MobileDashLink href="/dashboard" label={t("dashboard")} onClick={() => setMobileOpen(false)} />
                  <MobileDashLink href="/dashboard/messages" label={t("messages")} onClick={() => setMobileOpen(false)} />
                  <MobileDashLink href="/dashboard/settings" label={t("settings")} onClick={() => setMobileOpen(false)} />
                  <button onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }} className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-500">
                    {t("signOut")}
                  </button>
                </>
              ) : !isLoading ? (
                <MobileDashLink href="/auth/signin" label={t("logIn")} onClick={() => setMobileOpen(false)} />
              ) : null}
              {/* Language switcher mobile */}
              <button onClick={switchLocale} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-500">
                {locale === "en" ? "Portugues" : "English"}
              </button>
              {!isPhotographer && (
                <Link href="/photographers" onClick={() => setMobileOpen(false)} className="mt-2 rounded-lg bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white">
                  {t("bookPhotoshoot")}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

// i18n Link for public routes
function MobileNavLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-warm-50">
      {label}
    </Link>
  );
}

// Dashboard/auth links — now under [locale], use i18n Link
function MobileDashLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-warm-50">
      {label}
    </Link>
  );
}

function DropdownLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-warm-50">
      <DropdownIcon type={icon} />
      {label}
    </Link>
  );
}

function DropdownIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 text-gray-400";
  switch (type) {
    case "grid": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
    case "user": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case "settings": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "logout": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    default: return null;
  }
}
