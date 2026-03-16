"use client";

import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-warm-200 bg-warm-50/95 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-lg">
            P
          </div>
          <span className="font-display text-xl font-bold text-gray-900">
            Photo Portugal
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/photographers"
            className="text-sm font-medium text-gray-600 transition hover:text-primary-600"
          >
            Find Photographers
          </Link>
          <Link
            href="/locations"
            className="text-sm font-medium text-gray-600 transition hover:text-primary-600"
          >
            Locations
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-gray-600 transition hover:text-primary-600"
          >
            How It Works
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-gray-700 transition hover:text-primary-600"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Join as Photographer
            </Link>
          </div>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-gray-600"
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
            <Link
              href="/photographers"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600"
            >
              Find Photographers
            </Link>
            <Link
              href="/locations"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600"
            >
              Locations
            </Link>
            <Link
              href="/how-it-works"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600"
            >
              How It Works
            </Link>
            <hr className="border-warm-200" />
            <Link href="/auth/signin" className="text-sm font-medium text-gray-700">
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Join as Photographer
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
