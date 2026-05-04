"use client";

import { Link } from "@/i18n/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { unsplashUrl } from "@/lib/unsplash-images";
import { locations } from "@/lib/locations-data";
import { portugalCoverageStats } from "@/lib/location-coverage-stats";
import { useNotifications } from "@/contexts/NotificationContext";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Avatar } from "@/components/ui/Avatar";
import { ConciergeTrigger } from "@/components/concierge/ConciergeDrawer";
import { Compass, Search, ShieldCheck, HelpCircle, Users, Mail, LifeBuoy, MapPin, Heart, UserRound, Baby, Gem, Sparkles, Sun, UserPlus, CreditCard, Camera, BookOpen, TreePine, PartyPopper, Cake } from "lucide-react";

const TOP_DESTINATIONS = [
  { slug: "lisbon", name: "Lisbon", img: "photo-1536663060084-a0d9eeeaf44b" },
  { slug: "porto", name: "Porto", img: "photo-1756765786971-384a44daf35d" },
  { slug: "algarve", name: "Algarve", img: "photo-1560242374-7befcc667b39" },
  { slug: "sintra", name: "Sintra", img: "photo-1697394494123-c6c1323a14f7" },
  { slug: "madeira", name: "Madeira", img: "photo-1721241843813-c54b77496005" },
  { slug: "azores", name: "Azores", img: "photo-1542575749037-7ef4545e897d" },
  { slug: "cascais", name: "Cascais", img: "photo-1748792753424-38cbb745508a" },
  { slug: "lagos", name: "Lagos", img: "photo-1593897810048-0195fd308ee6" },
  { slug: "douro-valley", name: "Douro Valley", img: "photo-1693825208005-02563f6a95ce" },
];

const SHOOT_TYPES_DATA = [
  { key: "couples", href: "/photoshoots/couples", icon: Heart },
  { key: "family", href: "/photoshoots/family", icon: Baby },
  { key: "proposal", href: "/photoshoots/proposal", icon: Sparkles },
  { key: "elopement", href: "/photoshoots/elopement", icon: TreePine },
  { key: "wedding", href: "/photoshoots/wedding", icon: PartyPopper },
  { key: "honeymoon", href: "/photoshoots/honeymoon", icon: Sun },
  { key: "soloPortrait", href: "/photoshoots/solo", icon: UserRound },
  { key: "engagement", href: "/photoshoots/engagement", icon: Gem },
  { key: "birthday", href: "/photoshoots/birthday", icon: Cake },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && (!megaRef.current || !megaRef.current.contains(e.target as Node))) setActiveMenu(null);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleMenu(menu: string) {
    setActiveMenu(activeMenu === menu ? null : menu);
  }

  function switchLocale(target?: string) {
    // Default: toggle between EN/PT (legacy 2-button behavior)
    const newLocale = target ?? (locale === "en" ? "pt" : "en");
    const currentPath = window.location.pathname;
    // Strip any locale prefix (en is implicit)
    const cleanPath =
      currentPath
        .replace(/^\/(pt|de|es|fr)(\/|$)/, "/")
        .replace(/\/+$/, "") || "/";
    const newPath =
      newLocale === "en"
        ? cleanPath
        : `/${newLocale}${cleanPath === "/" ? "" : cleanPath}`;
    // Persist explicit choice — middleware honours `lang_choice` over Accept-Language.
    // (The legacy `locale_pref` cookie is no longer used for redirect logic; clear it
    // so users with stale auto-set values aren't stuck on the wrong locale.)
    document.cookie = `lang_choice=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    document.cookie = `locale_pref=;path=/;max-age=0;SameSite=Lax`;
    window.location.href = newPath;
  }

  const availableLocales: Array<{ code: string; label: string; flag: string }> = [
    { code: "en", label: "EN", flag: "🇬🇧" },
    { code: "pt", label: "PT", flag: "🇵🇹" },
    { code: "de", label: "DE", flag: "🇩🇪" },
    { code: "es", label: "ES", flag: "🇪🇸" },
    { code: "fr", label: "FR", flag: "🇫🇷" },
  ];
  const [langOpen, setLangOpen] = useState(false);

  return (
    <>
      {/* Main header */}
      <header className="sticky top-0 z-50 border-b border-warm-200 bg-white/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo — favicon on small screens, full logo on larger */}
          <Link href="/" className="shrink-0" onClick={() => setActiveMenu(null)}>
            <img src="/logo.svg" alt="Photo Portugal" width={140} height={28} className="hidden h-7 w-auto min-[440px]:block" />
            <img src="/favicon.svg" alt="Photo Portugal" width={28} height={28} className="h-7 w-7 min-[440px]:hidden" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex" ref={menuRef}>
            {/* Our Photographers — direct link */}
            <Link href="/photographers" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:text-primary-600">
              {t("ourPhotographers")}
            </Link>

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
            </div>

            {/* Explore menu burger */}
            <button
              onClick={() => toggleMenu("explore")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeMenu === "explore" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {t("explore")}
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language switcher — 2-button on photographer profiles, dropdown elsewhere */}
            {availableLocales.length === 2 ? (
              <div className="flex items-center overflow-hidden rounded-lg border border-warm-200 text-xs font-bold">
                {availableLocales.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { if (locale !== lang.code) switchLocale(lang.code); }}
                    className={`px-2 py-1.5 transition ${locale === lang.code ? "bg-primary-600 text-white" : "text-gray-400 hover:bg-warm-50 hover:text-gray-700"}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setLangOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-lg border border-warm-200 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-warm-50"
                  aria-label={t("language")}
                >
                  <span>{availableLocales.find((l) => l.code === locale)?.flag || "🌐"}</span>
                  <span>{availableLocales.find((l) => l.code === locale)?.label || locale.toUpperCase()}</span>
                  <svg className={`h-3 w-3 transition ${langOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {langOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-warm-200 bg-white py-1 shadow-lg">
                      {availableLocales.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => { setLangOpen(false); if (locale !== lang.code) switchLocale(lang.code); }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locale === lang.code ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-700"}`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                          {locale === lang.code && (
                            <svg className="ml-auto h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Concierge — opens slide-out drawer on any page (not for photographers, not on /concierge itself) */}
            {!isLoading && !isPhotographer && pathname !== "/concierge" && (
              <ConciergeTrigger
                aria-label={t("conciergeAriaLabel")}
                title={t("conciergeAriaLabel")}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-sm transition hover:shadow-md hover:scale-105"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
                </span>
              </ConciergeTrigger>
            )}

            {/* Book CTA — hide while loading to prevent flash */}
            {!isLoading && !isPhotographer && (
              <Link href="/choose-booking-type" className="hidden rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 sm:inline-flex">
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
                {!isPhotographer && (
                  <Link href="/dashboard/wishlist" aria-label={t("wishlist")} className="rounded-lg p-2 text-gray-400 transition hover:bg-warm-50 hover:text-red-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </Link>
                )}
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
            ) : pathname.startsWith("/dashboard") ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-warm-200" />
            ) : (
              <Link href="/auth/signin" className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-100 text-gray-500 transition hover:bg-warm-200 hover:text-gray-700" aria-label={t("logIn")}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
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

        <div ref={megaRef}>
        {/* Destinations mega menu — overlay */}
        {activeMenu === "destinations" && (
          <div className="hidden lg:block absolute left-0 right-0 top-full z-40 border-t border-warm-200 bg-white shadow-xl">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <div className="grid grid-cols-[1fr_1fr_200px] gap-8">
                {/* Column 1: Featured destinations with photos */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("popularDestinations")}</p>
                  <div className="grid grid-cols-3 gap-2">
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
                </div>

                {/* Column 2: All other locations */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaMoreLocations")}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {locations
                      .filter((loc) => !TOP_DESTINATIONS.some((d) => d.slug === loc.slug))
                      .map((loc) => (
                        <Link
                          key={loc.slug}
                          href={`/locations/${loc.slug}`}
                          onClick={() => setActiveMenu(null)}
                          className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-warm-50"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-primary-500" strokeWidth={1.5} />
                          <span className="text-sm text-gray-600 group-hover:text-primary-600">{loc.name}</span>
                        </Link>
                      ))}
                  </div>
                  <Link href="/locations" onClick={() => setActiveMenu(null)} className="mt-3 inline-flex px-2 text-sm font-semibold text-primary-600 hover:text-primary-700">
                    {t("allLocations", { count: portugalCoverageStats.displayPlacesLabel })}
                  </Link>
                </div>

                {/* Column 3: By Occasion */}
                <div className="border-l border-warm-100 pl-6">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("byOccasion")}</p>
                  <div className="space-y-0.5">
                    {SHOOT_TYPES_DATA.map((s) => {
                      const Icon = s.icon;
                      return (
                        <Link key={s.key} href={s.href} onClick={() => setActiveMenu(null)}
                          className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-warm-50">
                          <Icon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-primary-500" strokeWidth={1.5} />
                          <span className="text-sm text-gray-600 group-hover:text-primary-600">{t(`shootTypes.${s.key}`)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* For Clients mega menu — overlay */}
        {/* Combined Explore mega menu */}
        {activeMenu === "explore" && (
          <div className="hidden lg:block absolute left-0 right-0 top-full z-40 border-t border-warm-200 bg-white shadow-xl">
            <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-0">
                {/* Left: For Travelers */}
                <div className="pr-8 border-r border-warm-200">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary-500">{t("megaForTravelers")}</p>
                  <div className="space-y-0.5">
                    <Link href="/photographers" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Search className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("findPhotographers")}</p>
                        <p className="text-xs text-gray-400">{t("megaBrowseDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/locations" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <MapPin className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("photoMap")}</p>
                        <p className="text-xs text-gray-400">{t("photoMapDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/find-photographer" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Heart className="h-[18px] w-[18px] shrink-0 text-accent-600 transition group-hover:text-accent-700" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-semibold text-accent-700 group-hover:text-accent-800 transition">{t("findMePhotographer")}</p>
                        <p className="text-xs text-gray-500">{t("megaMatchDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/how-it-works" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Compass className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("howItWorks")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsHowItWorksDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/faq" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <HelpCircle className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("faq")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsFaqDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/contact" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Mail className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("contact")}</p>
                        <p className="text-xs text-gray-400">{t("megaContactDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Right: For Photographers */}
                <div className="pl-8">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaForPhotographers")}</p>
                  <div className="space-y-0.5">
                    <Link href="/for-photographers/join" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <UserPlus className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("joinAsPhotographer")}</p>
                        <p className="text-xs text-gray-400">{t("megaJoinDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/for-photographers/pricing" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <CreditCard className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("pricingPlans")}</p>
                        <p className="text-xs text-gray-400">{t("megaPricingDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/for-photographers/how-we-select" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("howWeSelect")}</p>
                        <p className="text-xs text-gray-400">{t("megaSelectionDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/blog" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <BookOpen className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("megaBlog")}</p>
                        <p className="text-xs text-gray-400">{t("megaBlogDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Old forClients mega menu — kept but hidden */}
        {false && activeMenu === "forClients" && (
          <div className="hidden lg:block absolute left-0 right-0 top-full z-40 border-t border-warm-200 bg-white shadow-xl">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <div className="grid grid-cols-3 gap-10">
                {/* Column 1: Getting Started */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaGettingStarted")}</p>
                  <div className="space-y-0.5">
                    <Link href="/how-it-works" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Compass className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("howItWorks")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsHowItWorksDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/photographers" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Search className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("findPhotographers")}</p>
                        <p className="text-xs text-gray-400">{t("megaBrowseDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/find-photographer" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Heart className="h-[18px] w-[18px] shrink-0 text-accent-600 transition group-hover:text-accent-700" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-semibold text-accent-700 group-hover:text-accent-800 transition">{t("findMePhotographer")}</p>
                        <p className="text-xs text-gray-500">{t("megaMatchDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Column 2: Trust & Quality */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaTrustQuality")}</p>
                  <div className="space-y-0.5">
                    <Link href="/for-photographers/how-we-select" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("howWeSelect")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsHowWeSelectDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/faq" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <HelpCircle className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("faq")}</p>
                        <p className="text-xs text-gray-400">{t("forClientsFaqDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Column 3: Company */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaCompany")}</p>
                  <div className="space-y-0.5">
                    <Link href="/about" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Users className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("about")}</p>
                        <p className="text-xs text-gray-400">{t("megaAboutDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/contact" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Mail className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("contact")}</p>
                        <p className="text-xs text-gray-400">{t("megaContactDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/support" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <LifeBuoy className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("helpCenter")}</p>
                        <p className="text-xs text-gray-400">{t("megaHelpDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="mt-5 flex items-center justify-center gap-4 rounded-lg bg-warm-50 px-5 py-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{t("megaCtaTitle")}</span>{" "}{t("megaCtaDesc")}
                </p>
                <Link href="/choose-booking-type" onClick={() => setActiveMenu(null)} className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                  {t("bookPhotoshoot")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Old For Photographers mega menu — kept but hidden */}
        {false && activeMenu === "photographers" && (
          <div className="hidden lg:block absolute left-0 right-0 top-full z-40 border-t border-warm-200 bg-white shadow-xl">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <div className="grid grid-cols-3 gap-10">
                {/* Column 1: Join */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaJoinUs")}</p>
                  <div className="space-y-0.5">
                    <Link href="/for-photographers/join" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <UserPlus className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("joinAsPhotographer")}</p>
                        <p className="text-xs text-gray-400">{t("megaJoinDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/for-photographers" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Camera className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("megaWhyJoin")}</p>
                        <p className="text-xs text-gray-400">{t("megaWhyJoinDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Column 2: Plans & Pricing */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaPlansAndPricing")}</p>
                  <div className="space-y-0.5">
                    <Link href="/for-photographers/pricing" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <CreditCard className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("pricingPlans")}</p>
                        <p className="text-xs text-gray-400">{t("megaPricingDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/how-it-works" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <Compass className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("howItWorks")}</p>
                        <p className="text-xs text-gray-400">{t("megaHowItWorksPhotographer")}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Column 3: Resources */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{t("megaResources")}</p>
                  <div className="space-y-0.5">
                    <Link href="/faq" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <HelpCircle className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("faq")}</p>
                        <p className="text-xs text-gray-400">{t("megaFaqPhotographerDesc")}</p>
                      </div>
                    </Link>
                    <Link href="/blog" onClick={() => setActiveMenu(null)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-warm-50">
                      <BookOpen className="h-[18px] w-[18px] shrink-0 text-gray-400 transition group-hover:text-primary-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-primary-600 transition">{t("megaBlog")}</p>
                        <p className="text-xs text-gray-400">{t("megaBlogDesc")}</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-warm-200 bg-white px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              <MobileNavLink href="/photographers" label={t("findPhotographers")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/find-photographer" label={t("getMatched")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/locations" label={t("photoMap")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/how-it-works" label={t("howItWorks")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/faq" label={t("faq")} onClick={() => setMobileOpen(false)} />
              <MobileNavLink href="/contact" label={t("contactUs")} onClick={() => setMobileOpen(false)} />
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
              ) : null}
              {!isPhotographer && (
                <Link href="/choose-booking-type" onClick={() => setMobileOpen(false)} className="mt-2 rounded-lg bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white">
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
