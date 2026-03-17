import type { Metadata } from "next";
import Link from "next/link";
import { locations } from "@/lib/locations-data";

export const metadata: Metadata = {
  title: "About Photo Portugal — Professional Vacation Photography",
  description:
    "Photo Portugal connects tourists with talented local photographers across Portugal. Learn about our mission, how we work, and why travelers trust us.",
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

      {/* Hero */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            Every trip to Portugal deserves <span className="text-primary-600">stunning photos</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-500">
            Photo Portugal was born from a simple idea: travelers deserve more than phone selfies.
            We connect you with talented local photographers who know Portugal&apos;s most breathtaking spots.
          </p>
        </div>
      </section>

      {/* Benefits for Clients */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900 text-center">Why choose Photo Portugal</h2>
        <p className="mt-3 text-center text-gray-500">Everything you need for the perfect photoshoot experience</p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
              title: "Verified Photographers",
              text: "Every photographer is reviewed for quality, professionalism, and portfolio. No surprises — only stunning results.",
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
              title: `${locations.length}+ Curated Locations`,
              text: "From Lisbon's streets to Algarve's cliffs, Sintra's palaces to Porto's riverside — we cover all of Portugal.",
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
              title: "Verified Reviews Only",
              text: "Every review comes from a real, completed booking. No fake testimonials — genuine feedback from travelers like you.",
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
              title: "Direct Messaging",
              text: "Chat with your photographer before and after booking. Discuss locations, outfits, timing, and special requests.",
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
              title: "Secure Payments",
              text: "Pay securely with cards, Apple Pay, or Google Pay. Your payment is held safely until photos are delivered.",
            },
            {
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
              title: "Easy Photo Delivery",
              text: "Receive your edited photos through our secure delivery gallery. View online, download individually, or grab the full ZIP.",
            },
          ].map((benefit) => (
            <div key={benefit.title} className="rounded-2xl border border-warm-200 bg-white p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
                <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {benefit.icon}
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900 text-center">How it works</h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-4">
            {[
              { step: "1", title: "Browse", desc: "Explore photographer profiles, portfolios, and reviews across your destination" },
              { step: "2", title: "Book", desc: "Choose a package, pick a date and time, and send your booking request" },
              { step: "3", title: "Shoot", desc: "Meet your photographer at the location and enjoy a relaxed, fun photoshoot" },
              { step: "4", title: "Receive", desc: "Get your professionally edited photos delivered through our secure gallery" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Photographers */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-gray-900">For photographers</h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Are you a photographer based in Portugal? Join our growing community and connect
              with travelers from around the world. We handle the marketing and booking — you
              focus on creating beautiful images.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                "Free to join — start with our Free plan",
                "Built-in booking & messaging system",
                "Secure payments with Stripe",
                "SEO-optimized profile page",
                "Portfolio showcase",
                "Upgrade for lower commission rates",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="h-4 w-4 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/signup?role=photographer"
                className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                Join as Photographer
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                View Plans & Pricing
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-warm-200 bg-white p-8">
            <h3 className="text-lg font-bold text-gray-900">Commission structure</h3>
            <p className="mt-2 text-sm text-gray-500">Transparent pricing — you always know what you earn</p>

            <div className="mt-6 space-y-4">
              {[
                { plan: "Free", commission: "20%", price: "Free", desc: "Get started with no monthly fee" },
                { plan: "Pro", commission: "15%", price: "\u20AC29/mo", desc: "Lower commission + more features" },
                { plan: "Premium", commission: "10%", price: "\u20AC59/mo", desc: "Lowest commission + top ranking" },
              ].map((tier) => (
                <div key={tier.plan} className="flex items-center justify-between rounded-lg border border-warm-100 p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{tier.plan}</p>
                    <p className="text-xs text-gray-400">{tier.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-600">{tier.commission}</p>
                    <p className="text-xs text-gray-400">{tier.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-gray-400">
              + 10% service fee charged to clients (not deducted from your earnings)
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-white">
            Ready to capture your Portugal story?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-300">
            Browse our photographers, choose your perfect location, and book your session today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/photographers"
              className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-700"
            >
              Browse Photographers
            </Link>
            <Link
              href="/locations"
              className="rounded-xl border-2 border-white/20 px-8 py-4 text-base font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              Explore Locations
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Questions? Email us at{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-400 hover:underline">
              info@photoportugal.com
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
