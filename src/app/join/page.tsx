import type { Metadata } from "next";
import Link from "next/link";
import { queryOne } from "@/lib/db";
import { EarlyBirdCounter } from "./EarlyBirdCounter";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Join Photo Portugal — Early Bird Program for Photographers",
  description: "Be among the first photographers on Portugal's newest photography marketplace. Founding members get Premium plan free forever. Limited spots available.",
  alternates: { canonical: "https://photoportugal.com/join" },
  openGraph: {
    title: "Join Photo Portugal — Early Bird Program",
    description: "Founding members get Premium plan free forever. Limited spots.",
    url: "https://photoportugal.com/join",
    images: ["/og-image.png"],
  },
};

const TIERS = [
  { key: "founding", label: "Founding 10", spots: 10, reward: "Premium forever", rewardDetail: "Premium plan free forever + exclusive Founding Photographer badge on your profile", color: "from-amber-500 to-orange-500", textColor: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  { key: "early50", label: "Early 50", spots: 50, reward: "6 months Premium free", rewardDetail: "Premium plan (€59/mo value) free for 6 months. Then choose any plan.", color: "from-primary-500 to-primary-700", textColor: "text-primary-700", bgColor: "bg-primary-50", borderColor: "border-primary-200" },
  { key: "first100", label: "First 100", spots: 100, reward: "3 months Pro free", rewardDetail: "Pro plan (€29/mo value) free for 3 months. Then choose any plan.", color: "from-accent-500 to-accent-700", textColor: "text-accent-700", bgColor: "bg-accent-50", borderColor: "border-accent-200" },
];

export default async function JoinPage() {
  let totalPhotographers = 0;
  try {
    const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles");
    totalPhotographers = parseInt(row?.count || "0");
  } catch {}

  // Determine which tier is active
  let activeTierIndex = -1;
  const thresholds = [10, 60, 160];
  for (let i = 0; i < thresholds.length; i++) {
    if (totalPhotographers < thresholds[i]) {
      activeTierIndex = i;
      break;
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Join Photo Portugal — Early Bird Program",
    description: "Be among the first photographers on Portugal's newest photography marketplace.",
    url: "https://photoportugal.com/join",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-semibold text-amber-300">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Early Bird Program
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Be a Founding Photographer
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            We&apos;re building Portugal&apos;s premier photography marketplace for tourists.
            Join now and lock in exclusive benefits before we launch publicly.
          </p>

          {/* Live counter */}
          <EarlyBirdCounter totalPhotographers={totalPhotographers} />

          <div className="mt-10">
            <Link
              href="/auth/signup?role=photographer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-10 py-4 text-base font-bold text-white shadow-lg transition hover:from-amber-600 hover:to-orange-600 hover:shadow-xl"
            >
              Claim Your Spot
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900">Early Bird Tiers</h2>
          <p className="mt-3 text-gray-500">The earlier you join, the bigger the reward</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TIERS.map((tier, i) => {
            const isFilled = i < activeTierIndex || activeTierIndex === -1;
            const isActive = i === activeTierIndex;
            const spotsUsed = i === 0 ? Math.min(totalPhotographers, 10) :
              i === 1 ? Math.min(Math.max(totalPhotographers - 10, 0), 50) :
              Math.min(Math.max(totalPhotographers - 60, 0), 100);
            const spotsLeft = tier.spots - spotsUsed;

            return (
              <div
                key={tier.key}
                className={`relative rounded-2xl border-2 p-6 transition ${
                  isActive ? `${tier.borderColor} ${tier.bgColor} ring-2 ring-offset-2 ${tier.borderColor.replace("border", "ring")}` :
                  isFilled ? "border-gray-200 bg-gray-50 opacity-60" :
                  "border-warm-200 bg-white"
                }`}
              >
                {isActive && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r ${tier.color} px-4 py-1 text-xs font-bold text-white shadow`}>
                    Now Open
                  </span>
                )}
                {isFilled && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-400 px-4 py-1 text-xs font-bold text-white">
                    Filled
                  </span>
                )}

                <h3 className={`text-xl font-bold ${isActive ? tier.textColor : "text-gray-900"}`}>
                  {tier.label}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{tier.spots} spots</p>

                <div className="mt-4">
                  <p className={`text-lg font-bold ${isActive ? tier.textColor : "text-gray-900"}`}>
                    {tier.reward}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{tier.rewardDetail}</p>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{spotsUsed} joined</span>
                    <span>{isFilled ? "Full" : `${spotsLeft} left`}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all`}
                      style={{ width: `${Math.min((spotsUsed / tier.spots) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* What you get */}
      <section className="border-y border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900">What You Get</h2>
            <p className="mt-3 text-gray-500">Everything you need to start earning from day one</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Tourist Clients", desc: "We bring international travelers looking for professional photographers in Portugal. No cold outreach needed.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
              { title: "Secure Payments", desc: "Stripe handles all payments. Money held in escrow until client accepts photos. No payment disputes.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { title: "Portfolio & Profile", desc: "Beautiful public profile with portfolio gallery, packages, reviews, and verified badge. Your online storefront.", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
              { title: "Booking Management", desc: "Receive requests, confirm bookings, chat with clients, manage your calendar. All in one dashboard.", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
              { title: "Photo Delivery", desc: "Password-protected gallery with ZIP download. Client accepts delivery, payment releases automatically.", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
              { title: "Verified Reviews", desc: "Only clients with completed bookings can leave reviews. Build trust with authentic, verified feedback.", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                  <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission transparency */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900">Transparent Pricing</h2>
          <p className="mt-3 text-gray-500">No hidden fees. You always know exactly what you earn.</p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-warm-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50">
                <th className="px-6 py-4 text-left font-semibold text-gray-900">Plan</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">Monthly</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">Commission</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">You earn on €200 booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              <tr>
                <td className="px-6 py-4 font-medium text-gray-900">Free</td>
                <td className="px-6 py-4 text-gray-500">€0</td>
                <td className="px-6 py-4 text-gray-500">20%</td>
                <td className="px-6 py-4 font-semibold text-gray-900">€160</td>
              </tr>
              <tr className="bg-primary-50/50">
                <td className="px-6 py-4 font-medium text-primary-700">Pro</td>
                <td className="px-6 py-4 text-gray-500">€29</td>
                <td className="px-6 py-4 text-gray-500">15%</td>
                <td className="px-6 py-4 font-semibold text-primary-700">€170</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-gray-900">Premium</td>
                <td className="px-6 py-4 text-gray-500">€59</td>
                <td className="px-6 py-4 text-gray-500">10%</td>
                <td className="px-6 py-4 font-semibold text-gray-900">€180</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-sm text-gray-400">
          Early bird photographers get their plan upgrade free — you still benefit from lower commission rates.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900">Getting Started Takes 10 Minutes</h2>
          </div>

          <div className="mt-12 space-y-6">
            {[
              { step: "1", title: "Create your account", desc: "Sign up with Google or email. Choose \"Photographer\" when asked." },
              { step: "2", title: "Set up your profile", desc: "Add your bio, avatar, cover photo, and select your locations in Portugal." },
              { step: "3", title: "Upload your portfolio", desc: "Show off your best work. We recommend at least 10 photos across different styles." },
              { step: "4", title: "Create packages", desc: "Set your prices and what's included. We suggest 2-3 packages at different price points." },
              { step: "5", title: "Connect Stripe", desc: "Link your Stripe account to receive payments directly to your bank." },
              { step: "6", title: "Get approved & start earning", desc: "Our team reviews your profile within 24 hours. Once approved, you're live!" },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Don&apos;t Miss Your Spot
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
            Once the founding spots are gone, they&apos;re gone forever.
            Join now and lock in your lifetime benefits.
          </p>
          <div className="mt-8">
            <Link
              href="/auth/signup?role=photographer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-10 py-4 text-base font-bold text-white shadow-lg transition hover:from-amber-600 hover:to-orange-600"
            >
              Claim Your Spot Now
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Free to sign up. No credit card required.</p>
        </div>
      </section>
    </>
  );
}
