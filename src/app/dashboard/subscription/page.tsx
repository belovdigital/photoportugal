import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { COMMISSION_RATES, PLAN_PRICES } from "@/lib/stripe";
import { StripeConnectSection } from "./StripeConnectSection";
import { SubscriptionManager } from "./SubscriptionManager";
import { AddOnsSection } from "./AddOnsSection";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{ plan: string; is_verified: boolean; is_featured: boolean; phone_number: string | null; phone_verified: boolean }>(
    "SELECT plan, is_verified, is_featured, phone_number, phone_verified FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  const currentPlan = profile?.plan || "free";
  const isVerified = profile?.is_verified || false;
  const isFeatured = profile?.is_featured || false;
  const phoneVerified = profile?.phone_verified || false;
  const phoneNumber = profile?.phone_number || null;

  const plans = [
    {
      name: "Free", price: String(PLAN_PRICES.free), current: currentPlan === "free",
      features: ["10 portfolio photos", "1 location", "Basic visibility", `${COMMISSION_RATES.free}% commission`],
    },
    {
      name: "Pro", price: String(PLAN_PRICES.pro), current: currentPlan === "pro",
      features: ["30 portfolio photos", "5 locations", "Priority ranking", "Profile analytics", `${COMMISSION_RATES.pro}% commission`],
    },
    {
      name: "Premium", price: String(PLAN_PRICES.premium), current: currentPlan === "premium",
      features: ["Unlimited photos", "All locations", "Top ranking", "Full analytics", `${COMMISSION_RATES.premium}% commission`, "Priority support"],
    },
  ];

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Subscription & Billing</h1>
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
            {plan.current && (
              <p className="mt-6 text-center text-sm font-semibold text-primary-600">Current Plan</p>
            )}
          </div>
        ))}
      </div>

      {/* Upgrade/Manage */}
      <div className="mt-8 rounded-xl border border-warm-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">Manage Plan</h2>
        <SubscriptionManager currentPlan={currentPlan} />
      </div>

      {/* Add-ons: Verified & Featured */}
      <AddOnsSection
        isVerified={isVerified}
        isFeatured={isFeatured}
        phoneVerified={phoneVerified}
        phoneNumber={phoneNumber}
      />

      {/* Stripe Connect */}
      <StripeConnectSection />
    </div>
  );
}
