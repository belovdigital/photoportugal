import Link from "next/link";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
        <div className="absolute inset-0 bg-[url('/images/ui/hero-pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Capture Your Perfect
              <span className="block text-primary-300">Moments in Portugal</span>
            </h1>
            <p className="mt-6 text-lg text-primary-100/90 sm:text-xl">
              Connect with talented local photographers who know the most
              breathtaking spots. From Lisbon&apos;s cobblestone streets to the
              Algarve&apos;s golden cliffs — your vacation memories, beautifully
              preserved.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/photographers"
                className="rounded-xl bg-white px-8 py-4 text-center text-base font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50 hover:shadow-xl"
              >
                Find a Photographer
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-xl border-2 border-white/30 px-8 py-4 text-center text-base font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
              >
                How It Works
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-12 max-w-2xl">
            <div className="flex overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex flex-1 items-center gap-3 px-6 py-4">
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <select className="w-full appearance-none bg-transparent text-gray-700 outline-none text-base">
                  <option value="">Where in Portugal?</option>
                  {locations.map((loc) => (
                    <option key={loc.slug} value={loc.slug}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <Link
                href="/photographers"
                className="flex items-center bg-primary-600 px-8 font-semibold text-white transition hover:bg-primary-700"
              >
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "50+", label: "Professional Photographers" },
            { value: "7", label: "Stunning Locations" },
            { value: "500+", label: "Happy Travelers" },
            { value: "4.9", label: "Average Rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-3xl font-bold text-primary-600 sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Locations */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Explore Portugal&apos;s Most Photogenic Locations
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Each destination offers unique backdrops for your perfect photoshoot
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <LocationCard key={location.slug} location={location} />
          ))}
        </div>
      </section>

      {/* How It Works */}
      <HowItWorksSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* CTA */}
      <section className="bg-primary-600">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to Capture Your Portugal Story?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
            Join hundreds of happy travelers who found their perfect photographer
            through Photo Portugal.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/photographers"
              className="rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-lg transition hover:bg-primary-50"
            >
              Browse Photographers
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              Join as a Photographer
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
