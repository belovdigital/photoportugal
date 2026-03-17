import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing Plans for Photographers",
  description:
    "Choose the right plan for your photography business on Photo Portugal. Free, Pro, and Premium plans available.",
};

const plans = [
  {
    name: "Free",
    price: "0",
    description: "Get started and test the platform",
    features: [
      "Up to 10 portfolio photos",
      "1 location",
      "Basic search visibility",
      "20% platform commission",
    ],
    cta: "Get Started Free",
    href: "/auth/signup?role=photographer",
    highlighted: false,
    available: true,
  },
  {
    name: "Pro",
    price: "29",
    description: "For photographers ready to grow their business",
    features: [
      "Up to 30 portfolio photos",
      "5 locations",
      "Priority search ranking",
      "Profile analytics",
      "15% platform commission",
    ],
    cta: "Upgrade to Pro",
    href: "/dashboard/subscription",
    highlighted: true,
    available: true,
  },
  {
    name: "Premium",
    price: "59",
    description: "Maximum visibility and lowest commission",
    features: [
      "Unlimited portfolio photos",
      "All locations",
      "Top search ranking",
      "Full analytics dashboard",
      "10% platform commission",
      "Priority support",
    ],
    cta: "Go Premium",
    href: "/dashboard/subscription",
    highlighted: false,
    available: true,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-gray-900">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Start for free, upgrade when you&apos;re ready to grow
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border p-8 ${
              plan.highlighted
                ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200"
                : "border-warm-200 bg-white"
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-bold text-white">
                Most Popular
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">&euro;{plan.price}</span>
              {plan.price !== "0" && <span className="text-gray-500">/month</span>}
            </div>
            <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={plan.href}
              className={`mt-8 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                plan.highlighted
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Add-ons */}
      <div className="mt-12">
        <h2 className="text-center font-display text-2xl font-bold text-gray-900">Add-ons</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Verified Badge</h3>
                <p className="text-sm text-gray-500">Identity verification for trust</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Get a verified badge by confirming your phone number via SMS. Builds trust with clients and boosts your booking rate.
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">&euro;19 one-time payment</p>
          </div>

          <div className="rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Featured Placement</h3>
                <p className="text-sm text-gray-500">Premium visibility boost</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Get featured on the homepage and appear first in search results. Includes a &quot;Featured&quot; badge on your profile and cards.
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">&euro;19/month</p>
          </div>
        </div>
      </div>

      {/* All plans include */}
      <div className="mt-12 rounded-xl bg-warm-50 p-8">
        <h3 className="text-center text-lg font-bold text-gray-900">All plans include</h3>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {[
            { icon: "📅", label: "Booking management" },
            { icon: "💬", label: "Client messaging" },
            { icon: "⭐", label: "Verified reviews" },
            { icon: "💳", label: "Stripe payments" },
            { icon: "🔍", label: "SEO-optimized profile" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <span className="text-2xl">{item.icon}</span>
              <p className="mt-1 text-sm text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Commission breakdown */}
      <div className="mt-8 rounded-xl border border-warm-200 bg-white p-8">
        <h3 className="text-lg font-bold text-gray-900">How payments work</h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">For clients</p>
            <p className="mt-1 text-sm text-gray-500">
              Pay the package price + 10% service fee. Secure payment via Stripe with support for cards, Apple Pay, and Google Pay.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">For photographers</p>
            <p className="mt-1 text-sm text-gray-500">
              Receive the package price minus platform commission. Automatic payouts to your bank account.
            </p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-warm-200">
                <th className="pb-2 text-left font-medium text-gray-500">Example: €300 package</th>
                <th className="pb-2 text-right font-medium text-gray-500">Free</th>
                <th className="pb-2 text-right font-medium text-gray-500">Pro</th>
                <th className="pb-2 text-right font-medium text-gray-500">Premium</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr><td className="py-1">Client pays</td><td className="py-1 text-right">€330</td><td className="py-1 text-right">€330</td><td className="py-1 text-right">€330</td></tr>
              <tr><td className="py-1">Service fee (10%)</td><td className="py-1 text-right">€30</td><td className="py-1 text-right">€30</td><td className="py-1 text-right">€30</td></tr>
              <tr><td className="py-1">Platform commission</td><td className="py-1 text-right text-red-500">-€60 (20%)</td><td className="py-1 text-right text-red-500">-€45 (15%)</td><td className="py-1 text-right text-red-500">-€30 (10%)</td></tr>
              <tr className="border-t border-warm-200 font-semibold text-gray-900"><td className="pt-2">You receive</td><td className="pt-2 text-right text-accent-600">€240</td><td className="pt-2 text-right text-accent-600">€255</td><td className="pt-2 text-right text-accent-600">€270</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
