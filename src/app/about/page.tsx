import type { Metadata } from "next";
import Link from "next/link";
import { locations } from "@/lib/locations-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "About Photo Portugal — Our Story & Mission",
  description:
    "Photo Portugal connects tourists with talented local photographers across Portugal. Learn about our mission and why travelers trust us.",
  alternates: { canonical: "https://photoportugal.com/about" },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Photo Portugal",
    url: "https://photoportugal.com",
    logo: "https://photoportugal.com/logo.svg",
    description:
      "Photo Portugal connects tourists visiting Portugal with talented local photographers for professional vacation photoshoots.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "info@photoportugal.com",
      contactType: "customer service",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "About", href: "/about" },
        ]}
      />
      {/* Hero */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            Why we built <span className="text-primary-600">Photo Portugal</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-500">
            Because the best memories deserve more than a selfie stick.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="space-y-8 text-gray-600 leading-relaxed">
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">The problem</h2>
            <p className="mt-4">
              Portugal is one of the most photogenic countries in Europe. Lisbon&apos;s golden light, Porto&apos;s
              dramatic riverfront, Sintra&apos;s fairytale palaces, the Algarve&apos;s raw coastal beauty — it&apos;s
              a photographer&apos;s dream. Yet every year, millions of tourists come home with nothing but
              blurry selfies and awkward &ldquo;can you take our photo?&rdquo; shots from strangers.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">Our mission</h2>
            <p className="mt-4">
              We believe every trip to Portugal deserves to be captured beautifully. That&apos;s why we
              created Photo Portugal — a platform where travelers can instantly find and book talented
              local photographers who know the best spots, the perfect timing, and how to make you
              feel comfortable in front of the camera.
            </p>
            <p className="mt-4">
              No more awkward poses. No more asking strangers. No more missing yourself from
              your own vacation photos. Just real, beautiful memories captured by someone who
              knows this country inside out.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">How it works</h2>
            <p className="mt-4">
              Browse photographer portfolios, read verified reviews from real travelers, and book your
              session in minutes. Pay securely through Stripe — your money is held safely until your
              photos are delivered. Your photographer will meet you at the location, guide you to the
              most photogenic spots, and make the whole experience relaxed and fun. You&apos;ll receive
              professionally edited photos in a private, password-protected gallery — view online,
              download individually, or grab the full collection as a ZIP archive.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">What makes us different</h2>
          </div>
        </div>

        {/* Trust points */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {[
            {
              title: "Every review is real",
              text: "Reviews are tied to completed bookings. No fake testimonials, no incentivized reviews — just honest feedback from travelers like you.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
            },
            {
              title: "Verified photographers",
              text: "Photographers go through phone verification and identity checks before earning a verified badge. You always know who you're booking.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
            },
            {
              title: "Secure payments via Stripe",
              text: "Pay with cards, Apple Pay, or Google Pay — all processed through Stripe, trusted by millions of businesses worldwide. Your payment is held securely until your photos are delivered and accepted, so you're always protected.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
            },
            {
              title: `${locations.length}+ locations covered`,
              text: "From the streets of Lisbon to the cliffs of the Algarve, from Douro Valley vineyards to the volcanic Azores — we cover all of Portugal.",
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-warm-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
              </div>
              <h3 className="mt-3 font-bold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            Ready to capture your Portugal story?
          </h2>
          <p className="mt-3 text-gray-500">
            Browse our photographers and book your session today.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/photographers"
              className="rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              Find a Photographer
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-xl border border-primary-200 px-8 py-3.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              See How It Works
            </Link>
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Questions? Email us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-500 hover:underline">
              info@photoportugal.com
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
