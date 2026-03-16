import Link from "next/link";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { HeroSearchBar } from "@/components/ui/HeroSearchBar";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";
import { heroImage } from "@/lib/unsplash-images";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Couple photoshoot in Portugal"
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950/90 via-primary-900/75 to-primary-800/60" />
        </div>
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
          <HeroSearchBar locations={locations.map(l => ({ slug: l.slug, name: l.name }))} />
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "50+", label: "Professional Photographers" },
            { value: `${locations.length}`, label: "Stunning Locations" },
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
          {locations.slice(0, 6).map((location) => (
            <LocationCard key={location.slug} location={location} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/locations"
            className="inline-flex rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            View All {locations.length} Locations
          </Link>
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
