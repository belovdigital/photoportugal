import Link from "next/link";
import { locations } from "@/lib/locations-data";
import { LocationCard } from "@/components/ui/LocationCard";
import { HeroSearchBar } from "@/components/ui/HeroSearchBar";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { TestimonialsSection } from "@/components/ui/TestimonialsSection";
import { unsplashUrl } from "@/lib/unsplash-images";

// Hero gallery photos — real Portugal moments with people
const heroPhotos = [
  { id: "photo-1765854638659-aa17a6b00543", alt: "Couple photoshoot on the beach" },
  { id: "photo-1536663060084-a0d9eeeaf44b", alt: "Lisbon tram streets" },
  { id: "photo-1560242374-7befcc667b39", alt: "Benagil cave Algarve" },
  { id: "photo-1542575749037-7ef4545e897d", alt: "Sete Cidades Azores" },
  { id: "photo-1697394494123-c6c1323a14f7", alt: "Pena Palace Sintra" },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Photo Portugal",
    url: "https://photoportugal.com",
    description: "Find and book professional photographers across Portugal for vacation photoshoots.",
    publisher: {
      "@type": "Organization",
      name: "Photo Portugal",
      logo: { "@type": "ImageObject", url: "https://photoportugal.com/logo.svg" },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://photoportugal.com/photographers?location={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ===== HERO ===== */}
      <section className="relative bg-warm-50 overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">

            {/* Left — Content */}
            <div className="max-w-xl">
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-warm-200 bg-white px-4 py-1.5 text-sm shadow-sm">
                <span className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
                <span className="text-gray-600">Trusted by <strong className="text-gray-900">500+</strong> happy travelers</span>
              </div>

              {/* Headline */}
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-gray-900 sm:text-5xl lg:text-[3.5rem]">
                Your Portugal trip deserves
                <span className="relative inline-block text-primary-600">
                  {" "}stunning photos
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5.5C47 2.5 153 2.5 199 5.5" stroke="#C94536" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
                  </svg>
                </span>
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-gray-500">
                Connect with talented local photographers who know Portugal&apos;s most
                breathtaking spots. Couples, families, solo travelers — we&apos;ll match
                you with the perfect photographer.
              </p>

              {/* Search */}
              <div className="mt-8">
                <HeroSearchBar locations={locations.map(l => ({ slug: l.slug, name: l.name }))} />
              </div>

              {/* Social proof row */}
              <div className="mt-8 flex items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Verified reviews</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Free cancellation</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>{locations.length} locations</span>
                </div>
              </div>
            </div>

            {/* Right — Photo grid */}
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-6 grid-rows-6 gap-3" style={{ height: "520px" }}>
                {/* Main large photo */}
                <div className="col-span-4 row-span-4 overflow-hidden rounded-2xl shadow-xl">
                  <img
                    src={unsplashUrl(heroPhotos[0].id, 800)}
                    alt={heroPhotos[0].alt}
                    className="h-full w-full object-cover"
                    fetchPriority="high"
                  />
                </div>
                {/* Top right */}
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={unsplashUrl(heroPhotos[1].id, 400)}
                    alt={heroPhotos[1].alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Bottom left */}
                <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={unsplashUrl(heroPhotos[2].id, 400)}
                    alt={heroPhotos[2].alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Bottom center */}
                <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={unsplashUrl(heroPhotos[3].id, 400)}
                    alt={heroPhotos[3].alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Bottom right */}
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={unsplashUrl(heroPhotos[4].id, 400)}
                    alt={heroPhotos[4].alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Floating review card */}
              <div className="absolute -left-6 bottom-8 rounded-xl border border-warm-200 bg-white p-4 shadow-lg" style={{ maxWidth: "240px" }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-gray-900">5.0</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                  &ldquo;Maria made us feel so comfortable. The photos are incredible!&rdquo;
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Sarah T. &middot; Lisbon</p>
              </div>
            </div>

            {/* Mobile hero image */}
            <div className="relative -mx-4 overflow-hidden rounded-2xl sm:mx-0 lg:hidden">
              <div className="aspect-[4/3]">
                <img
                  src={unsplashUrl(heroPhotos[0].id, 800)}
                  alt={heroPhotos[0].alt}
                  className="h-full w-full object-cover"
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="border-y border-warm-200 bg-white">
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

      {/* ===== LOCATIONS ===== */}
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

      {/* ===== CTA ===== */}
      <section className="relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to Capture Your Portugal Story?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">
            Join hundreds of happy travelers who found their perfect photographer
            through Photo Portugal.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/photographers"
              className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              Browse Photographers
            </Link>
            <Link
              href="/auth/signup?role=photographer"
              className="rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              Join as a Photographer
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
