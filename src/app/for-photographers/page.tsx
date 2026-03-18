import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Join Photo Portugal — Earn Money as a Vacation Photographer in Portugal",
  description: "Join Portugal's growing photographer marketplace. Connect with international travelers, manage bookings, and grow your photography business. Free to get started.",
  alternates: { canonical: "https://photoportugal.com/for-photographers" },
};

export default function ForPhotographersPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "For Photographers", href: "/for-photographers" },
        ]}
      />
      {/* Hero */}
      <section className="bg-gray-900 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Focus on shooting. We handle the rest.
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            Thousands of tourists dream of beautiful photos from Portugal&apos;s most stunning
            locations — and they&apos;re looking for you. We bring the clients, manage bookings,
            handle payments, and let you do what you love.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/auth/signup?role=photographer" className="rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700">
              Join for Free
            </Link>
            <Link href="/pricing" className="rounded-xl border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/5">
              View Plans
            </Link>
          </div>
        </div>
      </section>

      {/* How it works for photographers */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-center font-display text-3xl font-bold text-gray-900">How it works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            { step: "1", title: "Create your profile", desc: "Sign up, upload your portfolio, set your locations and packages. It takes just a few minutes." },
            { step: "2", title: "Get approved", desc: "Our team reviews your profile to ensure quality. Once approved, you'll be visible to thousands of tourists." },
            { step: "3", title: "Start booking", desc: "Receive booking requests and simply confirm the time that works for you. We handle payments, reminders, and delivery — you just show up and shoot." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600">
                {item.step}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-warm-200 bg-warm-50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900">Why join Photo Portugal?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              { title: "We bring you clients", desc: "Tourists from the US, UK, Germany, and beyond — all actively searching for photographers in Portugal. You just confirm the time." },
              { title: "We handle payments", desc: "Secure payments via Stripe — clients pay upfront, you get paid automatically when photos are delivered. No invoicing, no chasing." },
              { title: "We manage everything", desc: "Booking requests, payment reminders, shoot reminders, photo delivery — the platform automates it all. You focus on the creative work." },
              { title: "SEO-optimized profile", desc: "Your profile page is optimized for Google. Clients searching 'photographer in Lisbon' will find you organically." },
              { title: "Verified reviews", desc: "Every review is tied to a real booking. Build trust with authentic social proof that converts." },
              { title: "You set the prices", desc: "Create your own packages, set your rates, choose your locations. Full control over your business — we never dictate your pricing." },
            ].map((b) => (
              <div key={b.title} className="rounded-xl border border-warm-200 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{b.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community — Coming Soon */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-block rounded-full bg-accent-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-700">
            Coming Soon
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900">
            Photographer Community
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            We&apos;re building a community for Portugal-based photographers — with meetups,
            workshops, and learning sessions. Connect with fellow creatives, share experiences,
            and grow together.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-gray-900">Ready to get started?</h2>
          <p className="mt-4 text-gray-500">Join for free, set up your profile, and start receiving bookings.</p>
          <Link href="/auth/signup?role=photographer" className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700">
            Create Your Photographer Profile
          </Link>
        </div>
      </section>
    </>
  );
}
