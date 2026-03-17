"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

const TOP_DESTINATIONS = [
  { slug: "lisbon", name: "Lisbon" },
  { slug: "porto", name: "Porto" },
  { slug: "algarve", name: "Algarve" },
  { slug: "sintra", name: "Sintra" },
  { slug: "madeira", name: "Madeira" },
  { slug: "azores", name: "Azores" },
  { slug: "cascais", name: "Cascais" },
  { slug: "lagos", name: "Lagos" },
  { slug: "douro-valley", name: "Douro Valley" },
  { slug: "nazare", name: "Nazaré" },
];

const SHOOT_TYPES = [
  { label: "Couples", href: "/photographers?shoot=Couples" },
  { label: "Family", href: "/photographers?shoot=Family" },
  { label: "Solo Portrait", href: "/photographers?shoot=Solo+Portrait" },
  { label: "Engagement", href: "/photographers?shoot=Engagement" },
  { label: "Proposal", href: "/photographers?shoot=Proposal" },
  { label: "Honeymoon", href: "/photographers?shoot=Honeymoon" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const isPhotographer = role === "photographer";
  const isLoading = status === "loading";

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

  return (
    <>
      {/* Announcement bar */}
      <div className="bg-gray-900 text-center text-xs sm:text-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
          <p className="text-gray-300">
            <span className="text-white font-semibold">Professional vacation photography</span> across 23 stunning locations in Portugal
            <Link href="/photographers" className="ml-2 text-primary-400 hover:text-primary-300 font-medium">
              Browse now &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 border-b border-warm-200 bg-white/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="shrink-0" onClick={() => setActiveMenu(null)}>
            <img src="/logo.svg" alt="Photo Portugal" className="h-7 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex" ref={menuRef}>
            {/* Destinations dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleMenu("destinations")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMenu === "destinations" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
                }`}
              >
                Destinations
                <svg className={`h-3.5 w-3.5 transition ${activeMenu === "destinations" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMenu === "destinations" && (
                <div className="absolute left-1/2 top-full mt-2 w-[520px] -translate-x-1/2 rounded-xl border border-warm-200 bg-white p-5 shadow-xl">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Popular Cities</p>
                      <div className="mt-3 grid grid-cols-2 gap-1">
                        {TOP_DESTINATIONS.map((d) => (
                          <Link
                            key={d.slug}
                            href={`/locations/${d.slug}`}
                            onClick={() => setActiveMenu(null)}
                            className="rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600"
                          >
                            {d.name}
                          </Link>
                        ))}
                      </div>
                      <Link
                        href="/locations"
                        onClick={() => setActiveMenu(null)}
                        className="mt-3 inline-flex text-sm font-semibold text-primary-600 hover:text-primary-700"
                      >
                        View all 23 locations &rarr;
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">By Occasion</p>
                      <div className="mt-3 space-y-1">
                        {SHOOT_TYPES.map((s) => (
                          <Link
                            key={s.label}
                            href={s.href}
                            onClick={() => setActiveMenu(null)}
                            className="block rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600"
                          >
                            {s.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="/photographers" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:text-primary-600">
              Photographers
            </Link>

            <Link href="/how-it-works" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:text-primary-600">
              How It Works
            </Link>

            <Link href="/faq" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-warm-50 hover:text-primary-600">
              FAQ
            </Link>

            {/* For Photographers dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleMenu("photographers")}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeMenu === "photographers" ? "bg-warm-50 text-primary-600" : "text-gray-700 hover:bg-warm-50"
                }`}
              >
                For Photographers
                <svg className={`h-3.5 w-3.5 transition ${activeMenu === "photographers" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeMenu === "photographers" && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-warm-200 bg-white p-5 shadow-xl">
                  <p className="text-sm font-semibold text-gray-900">Become a photographer</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Join our network and connect with travelers from around the world
                  </p>
                  <div className="mt-4 space-y-1">
                    <Link
                      href="/auth/signup?role=photographer"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      Join as Photographer
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Pricing Plans
                    </Link>
                    <Link
                      href="/how-it-works"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition hover:bg-primary-50 hover:text-primary-600"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      How It Works
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/photographers"
              className="hidden rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 sm:inline-flex"
            >
              Book a Photoshoot
            </Link>

            {isLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-warm-200" />
            ) : user ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 rounded-full border border-warm-200 p-1 pr-2 transition hover:bg-warm-50"
                >
                  {user.image ? (
                    <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                      {user.name?.charAt(0) ?? "U"}
                    </div>
                  )}
                  <svg className={`h-3.5 w-3.5 text-gray-400 transition ${profileOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-warm-200 bg-white shadow-lg">
                    <div className="border-b border-warm-100 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <DropdownLink href="/dashboard" icon="grid" label="Dashboard" onClick={() => setProfileOpen(false)} />
                      <DropdownLink href="/dashboard/messages" icon="chat" label="Messages" onClick={() => setProfileOpen(false)} />
                      {isPhotographer && (
                        <DropdownLink href="/dashboard/photographer" icon="user" label="My Profile" onClick={() => setProfileOpen(false)} />
                      )}
                      <DropdownLink href="/dashboard/settings" icon="settings" label="Settings" onClick={() => setProfileOpen(false)} />
                    </div>
                    <div className="border-t border-warm-100 py-1">
                      <button
                        onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/" }); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-500 transition hover:bg-warm-50"
                      >
                        <DropdownIcon type="logout" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/signin" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
                Log In
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-gray-600 lg:hidden"
              aria-label="Menu"
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
              <MobileLink href="/photographers" label="Find Photographers" onClick={() => setMobileOpen(false)} />
              <MobileLink href="/locations" label="All Destinations" onClick={() => setMobileOpen(false)} />
              <MobileLink href="/how-it-works" label="How It Works" onClick={() => setMobileOpen(false)} />
              <MobileLink href="/faq" label="FAQ" onClick={() => setMobileOpen(false)} />
              <hr className="my-2 border-warm-200" />
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">For Photographers</p>
              <MobileLink href="/auth/signup?role=photographer" label="Join as Photographer" onClick={() => setMobileOpen(false)} />
              <MobileLink href="/pricing" label="Pricing Plans" onClick={() => setMobileOpen(false)} />
              <hr className="my-2 border-warm-200" />
              {user ? (
                <>
                  <MobileLink href="/dashboard" label="Dashboard" onClick={() => setMobileOpen(false)} />
                  <MobileLink href="/dashboard/messages" label="Messages" onClick={() => setMobileOpen(false)} />
                  <MobileLink href="/dashboard/settings" label="Settings" onClick={() => setMobileOpen(false)} />
                  <button onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }} className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-500">
                    Sign Out
                  </button>
                </>
              ) : !isLoading ? (
                <MobileLink href="/auth/signin" label="Log In" onClick={() => setMobileOpen(false)} />
              ) : null}
              <Link href="/photographers" onClick={() => setMobileOpen(false)} className="mt-2 rounded-lg bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white">
                Book a Photoshoot
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function MobileLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
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
    case "chat": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
    case "user": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case "settings": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "logout": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
    default: return null;
  }
}
