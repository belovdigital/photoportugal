import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Photo Portugal",
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

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <h1 className="font-display text-4xl font-bold text-gray-900">
          About Photo Portugal
        </h1>

        <div className="mt-8 space-y-6 text-gray-600 leading-relaxed">
          <p className="text-lg">
            Photo Portugal was born from a simple idea: every traveler deserves to bring home
            more than just phone selfies from their trip to Portugal.
          </p>

          <p>
            Portugal is one of the most photogenic countries in Europe — from Lisbon&apos;s
            sun-drenched cobblestone streets and Porto&apos;s dramatic riverside to the Algarve&apos;s
            golden cliffs and the Azores&apos; volcanic landscapes. Yet finding a reliable, talented
            photographer who knows these locations intimately has always been a challenge for tourists.
          </p>

          <p>
            That&apos;s why we created Photo Portugal — a marketplace that connects travelers with
            vetted local photographers who know exactly when and where to capture the perfect shot.
            Every photographer on our platform is selected for their talent, professionalism, and
            deep knowledge of their local area.
          </p>

          <h2 className="font-display text-2xl font-bold text-gray-900 pt-4">How it works</h2>

          <p>
            Browse photographer profiles, view their portfolios, read verified reviews from
            real clients, and book your session in minutes. Whether you&apos;re celebrating
            a honeymoon, a family vacation, an engagement, or simply want professional solo
            portraits against stunning Portuguese backdrops — we&apos;ll match you with the
            perfect photographer.
          </p>

          <h2 className="font-display text-2xl font-bold text-gray-900 pt-4">Why trust us</h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>Every review is tied to a real, completed booking — no fake reviews</li>
            <li>Photographers are verified for quality and professionalism</li>
            <li>23+ carefully curated locations across all of Portugal</li>
            <li>Direct messaging with your photographer before and after booking</li>
            <li>Flexible cancellation and rescheduling policies</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-gray-900 pt-4">For photographers</h2>

          <p>
            Are you a photographer based in Portugal? Join our growing community and connect
            with travelers from around the world. We handle the marketing and booking — you
            focus on what you do best: creating beautiful images.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/photographers"
            className="rounded-xl bg-primary-600 px-8 py-4 text-center text-base font-semibold text-white transition hover:bg-primary-700"
          >
            Find a Photographer
          </Link>
          <Link
            href="/auth/signup?role=photographer"
            className="rounded-xl border border-primary-200 px-8 py-4 text-center text-base font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            Join as Photographer
          </Link>
        </div>
      </div>
    </>
  );
}
