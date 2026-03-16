"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const isPhotographer = role === "photographer";
  const isLoading = status === "loading";

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const profileSlug = user?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <header className="sticky top-0 z-50 border-b border-warm-200 bg-warm-50/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <img src="/logo.svg" alt="Photo Portugal" className="h-7 w-auto" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {!isPhotographer && (
            <Link href="/photographers" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
              Find Photographers
            </Link>
          )}
          <Link href="/locations" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
            Locations
          </Link>
          {!user && !isLoading && (
            <Link href="/how-it-works" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
              How It Works
            </Link>
          )}

          <div className="h-5 w-px bg-warm-200" />

          {/* Auth area */}
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded bg-warm-200" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-warm-200" />
            </div>
          ) : user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-full p-1 transition hover:bg-warm-100"
              >
                {user.image ? (
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                    {user.name?.charAt(0) ?? "U"}
                  </div>
                )}
                <svg className={`h-4 w-4 text-gray-400 transition ${profileOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-warm-200 bg-white shadow-lg">
                  <div className="border-b border-warm-100 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-warm-50"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Dashboard
                    </Link>
                    {isPhotographer && profileSlug && (
                      <Link
                        href={`/photographers/${profileSlug}`}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-warm-50"
                      >
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </Link>
                    )}
                    {isPhotographer && (
                      <Link
                        href="/dashboard/photographer"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-warm-50"
                      >
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-warm-100 py-1">
                    <button
                      onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-500 transition hover:bg-warm-50"
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/auth/signin" className="text-sm font-medium text-gray-700 transition hover:text-primary-600">
                Sign In
              </Link>
              <Link
                href="/auth/signup?role=photographer"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                Join as Photographer
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-gray-600 md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-warm-200 bg-warm-50 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {!isPhotographer && (
              <Link href="/photographers" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
                Find Photographers
              </Link>
            )}
            <Link href="/locations" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
              Locations
            </Link>
            {!user && !isLoading && (
              <Link href="/how-it-works" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
                How It Works
              </Link>
            )}
            <hr className="border-warm-200" />
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-700">
                  Dashboard
                </Link>
                {isPhotographer && profileSlug && (
                  <Link href={`/photographers/${profileSlug}`} onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
                    My Profile
                  </Link>
                )}
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="text-left text-sm text-gray-500"
                >
                  Sign Out
                </button>
              </>
            ) : !isLoading ? (
              <>
                <Link href="/auth/signin" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-700">
                  Sign In
                </Link>
                <Link
                  href="/auth/signup?role=photographer"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Join as Photographer
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
