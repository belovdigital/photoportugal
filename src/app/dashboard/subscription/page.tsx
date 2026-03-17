import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{ plan: string }>(
    "SELECT plan FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  const currentPlan = profile?.plan || "free";

  const plans = [
    {
      name: "Free", price: "0", current: currentPlan === "free",
      features: ["10 portfolio photos", "1 location", "Basic visibility", "20% commission"],
    },
    {
      name: "Pro", price: "19", current: currentPlan === "pro",
      features: ["50 portfolio photos", "3 locations", "Priority ranking", "Verified badge", "Analytics", "12% commission"],
    },
    {
      name: "Premium", price: "39", current: currentPlan === "premium",
      features: ["Unlimited photos", "All locations", "Top ranking", "Featured badge", "Full analytics", "7% commission"],
    },
  ];

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
      <p className="mt-1 text-gray-500">Manage your plan and payment method</p>

      {/* Current plan */}
      <div className="mt-6 rounded-xl border border-warm-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary-50 px-4 py-1 text-sm font-bold uppercase text-primary-600">
            {currentPlan}
          </span>
          <span className="text-sm text-gray-500">Current plan</span>
        </div>
      </div>

      {/* Plans */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 ${
              plan.current ? "border-primary-300 bg-primary-50 ring-1 ring-primary-200" : "border-warm-200 bg-white"
            }`}
          >
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <div className="mt-2">
              <span className="text-3xl font-bold text-gray-900">&euro;{plan.price}</span>
              {plan.price !== "0" && <span className="text-gray-500">/month</span>}
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="h-4 w-4 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {plan.current ? (
              <p className="mt-6 text-center text-sm font-semibold text-primary-600">Current Plan</p>
            ) : (
              <button disabled className="mt-6 w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-400">
                Coming Soon
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Payment method */}
      <div className="mt-8 rounded-xl border border-warm-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Payment Method</h2>
        <p className="mt-2 text-sm text-gray-500">
          Payment processing is coming soon. When available, you&apos;ll be able to upgrade your plan and manage your billing here.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Want to upgrade now? <a href="mailto:info@photoportugal.com" className="font-semibold text-primary-600 hover:underline">Contact us</a>
        </p>
      </div>
    </div>
  );
}
