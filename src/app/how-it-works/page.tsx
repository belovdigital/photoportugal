import type { Metadata } from "next";
import Link from "next/link";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how to book a professional photographer in Portugal with Photo Portugal. Three simple steps to your perfect vacation photoshoot.",
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            How It Works
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Booking a professional photographer in Portugal is simple, safe, and
            fun. Here&apos;s everything you need to know.
          </p>
        </div>
      </section>

      <HowItWorksSection />

      {/* For Travelers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          For Travelers
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {[
            {
              title: "Browse & Compare",
              text: "View photographer portfolios, read verified reviews, compare packages and prices. Filter by location, style, and budget.",
            },
            {
              title: "Book Instantly",
              text: "Choose your date, time, and package. Your photographer confirms within 24 hours. No commitment until confirmed.",
            },
            {
              title: "Meet & Shoot",
              text: "Meet your photographer at the agreed location. Relax, be yourself, and enjoy a fun photoshoot experience.",
            },
            {
              title: "Get Your Photos",
              text: "Receive your professionally edited photos within 3-7 days. Download in high resolution from your personal gallery.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-warm-200 bg-white p-8"
            >
              <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For Photographers */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            For Photographers
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Join Portugal&apos;s growing community of vacation photographers and
            reach international clients.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                title: "Create Your Profile",
                text: "Showcase your best work with a beautiful portfolio page. Add your locations, packages, and availability.",
              },
              {
                title: "Get Discovered",
                text: "Our SEO-optimized pages help international travelers find you when searching for photographers in your area.",
              },
              {
                title: "Grow Your Business",
                text: "Receive booking requests, manage your calendar, and build your reputation with verified reviews.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-lg font-bold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              Join as a Photographer
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          Frequently Asked Questions
        </h2>
        <div className="mt-8 space-y-6">
          {[
            {
              q: "How far in advance should I book?",
              a: "We recommend booking at least 3-5 days in advance, especially during peak season (June-September). However, some photographers accept last-minute bookings.",
            },
            {
              q: "What if it rains?",
              a: "Your photographer will suggest alternative covered locations or reschedule for free if weather conditions are unfavorable.",
            },
            {
              q: "How do I receive my photos?",
              a: "You'll receive a link to your private online gallery within 3-7 days after your photoshoot. All photos are professionally edited and available for high-resolution download.",
            },
            {
              q: "Can I request specific locations?",
              a: "Absolutely! While your photographer will suggest the best spots, you're welcome to request specific locations. They'll let you know if any require permits or have timing considerations.",
            },
            {
              q: "What should I wear?",
              a: "Your photographer can provide styling tips based on your chosen location. Generally, solid colors and classic styles photograph best. Avoid large logos and busy patterns.",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl border border-warm-200 bg-white p-6"
            >
              <h3 className="font-semibold text-gray-900">{faq.q}</h3>
              <p className="mt-2 text-sm text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
