"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const isPhotographer = role === "photographer";

  return (
    <header className="sticky top-0 z-50 border-b border-warm-200 bg-warm-50/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <img
            src="/logo.svg"
            alt="Photo Portugal"
            className="h-7 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {/* Main links */}
          {!isPhotographer && (
            <Link href="/photographers" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
              Find Photographers
            </Link>
          )}
          <Link href="/locations" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
            Locations
          </Link>
          {!user && (
            <Link href="/how-it-works" className="text-sm font-medium text-gray-600 transition hover:text-primary-600">
              How It Works
            </Link>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-warm-200" />

          {/* Auth area */}
          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 transition hover:text-primary-600">
                Dashboard
              </Link>
              {isPhotographer && (
                <Link
                  href={`/photographers/${user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                  className="text-sm font-medium text-gray-600 transition hover:text-primary-600"
                >
                  My Profile
                </Link>
              )}
              <div className="flex items-center gap-2.5">
                {user.image ? (
                  <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">
                    {user.name?.charAt(0) ?? "U"}
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-sm text-gray-400 transition hover:text-gray-600"
                >
                  Sign Out
                </button>
              </div>
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
          <div className="flex flex-col gap-4">
            {!isPhotographer && (
              <Link href="/photographers" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
                Find Photographers
              </Link>
            )}
            <Link href="/locations" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-gray-600">
              Locations
            </Link>
            {!user && (
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
                {isPhotographer && (
                  <Link
                    href={`/photographers/${user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-sm font-medium text-gray-600"
                  >
                    My Profile
                  </Link>
                )}
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="text-left text-sm text-gray-500"
                >
                  Sign Out ({user.name})
                </button>
              </>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </header>
  );
}
