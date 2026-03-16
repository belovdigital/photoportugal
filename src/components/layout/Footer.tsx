import Link from "next/link";
import { locations } from "@/lib/locations-data";

export function Footer() {
  return (
    <footer className="border-t border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
                P
              </div>
              <span className="font-display text-lg font-bold text-gray-900">
                Photo Portugal
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              Connecting travelers with talented local photographers across
              Portugal. Capture your perfect moments.
            </p>
          </div>

          {/* Locations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Top Locations
            </h3>
            <ul className="mt-3 space-y-2">
              {locations.map((loc) => (
                <li key={loc.slug}>
                  <Link
                    href={`/locations/${loc.slug}`}
                    className="text-sm text-gray-500 transition hover:text-primary-600"
                  >
                    Photographers in {loc.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Photographers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              For Photographers
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/auth/signup"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Join as Photographer
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Company</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-warm-200 pt-6">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Photo Portugal. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
