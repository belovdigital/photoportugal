import Link from "next/link";
import Image from "next/image";
import { locations } from "@/lib/locations-data";

const TOP_LOCATIONS = ["lisbon", "porto", "algarve", "sintra", "madeira", "azores", "cascais", "lagos"];

export function Footer() {
  const topLocations = locations.filter((l) => TOP_LOCATIONS.includes(l.slug));

  return (
    <footer className="border-t border-warm-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Photo Portugal"
                width={180}
                height={32}
                className="h-8 w-auto"
              />
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
              {topLocations.map((loc) => (
                <li key={loc.slug}>
                  <Link
                    href={`/locations/${loc.slug}`}
                    className="text-sm text-gray-500 transition hover:text-primary-600"
                  >
                    Photographers in {loc.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/locations"
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700"
                >
                  View all {locations.length} locations
                </Link>
              </li>
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
                  href="/auth/signup?role=photographer"
                  className="text-sm text-gray-500 transition hover:text-primary-600"
                >
                  Join as Photographer
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
                <Link href="/about" className="text-sm text-gray-500 transition hover:text-primary-600">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-500 transition hover:text-primary-600">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-500 transition hover:text-primary-600">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-gray-500 transition hover:text-primary-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-500 transition hover:text-primary-600">
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
