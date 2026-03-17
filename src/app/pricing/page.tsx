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
    description: "Get started and see if Photo Portugal is right for you",
    features: [
      "Up to 10 portfolio photos",
      "1 location",
      "Basic search visibility",
      "Profile page",
      "Booking requests",
      "Messaging",
    ],
    cta: "Get Started Free",
    href: "/auth/signup?role=photographer",
    highlighted: false,
    available: true,
  },
  {
    name: "Pro",
    price: "19",
    description: "For established photographers ready to grow",
    features: [
      "Up to 50 portfolio photos",
      "3 locations",
      "Priority search ranking",
      "Profile analytics",
      "Verified badge",
      "12% booking commission",
    ],
    cta: "Coming Soon",
    href: "#",
    highlighted: true,
    available: false,
  },
  {
    name: "Premium",
    price: "39",
    description: "Maximum visibility and features for top photographers",
    features: [
      "Unlimited portfolio photos",
      "All locations",
      "Top search ranking",
      "Featured badge",
      "Detailed analytics",
      "Dedicated SEO page",
      "7% booking commission",
      "Priority support",
    ],
    cta: "Coming Soon",
    href: "#",
    highlighted: false,
    available: false,
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

            {plan.available ? (
              <Link
                href={plan.href}
                className="mt-8 block w-full rounded-xl bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
              >
                {plan.cta}
              </Link>
            ) : (
              <button
                disabled
                className="mt-8 block w-full rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-gray-400"
              >
                {plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl bg-warm-50 p-8 text-center">
        <h3 className="text-lg font-bold text-gray-900">All plans include</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <span>Booking management</span>
          <span>Client messaging</span>
          <span>Verified reviews</span>
          <span>Stripe payments</span>
          <span>SEO-optimized profile</span>
        </div>
      </div>

      {/* How payments work */}
      <div className="mt-8 rounded-xl border border-warm-200 bg-white p-8">
        <h3 className="text-lg font-bold text-gray-900">How payments work</h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">For clients</p>
            <p className="mt-1 text-sm text-gray-500">
              Clients pay the package price plus a 10% service fee. Payment is processed securely via Stripe
              when the photographer confirms the booking.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">For photographers</p>
            <p className="mt-1 text-sm text-gray-500">
              You receive the package price minus platform commission (depends on your plan).
              Payouts are processed automatically to your connected bank account via Stripe.
            </p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
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
              <tr><td className="py-1">Platform commission</td><td className="py-1 text-right text-red-500">-€60 (20%)</td><td className="py-1 text-right text-red-500">-€36 (12%)</td><td className="py-1 text-right text-red-500">-€21 (7%)</td></tr>
              <tr className="border-t border-warm-200 font-semibold text-gray-900"><td className="pt-2">You receive</td><td className="pt-2 text-right text-accent-600">€240</td><td className="pt-2 text-right text-accent-600">€264</td><td className="pt-2 text-right text-accent-600">€279</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
