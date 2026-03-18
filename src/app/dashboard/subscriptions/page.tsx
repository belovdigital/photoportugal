import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { COMMISSION_RATES, PLAN_PRICES } from "@/lib/stripe";
import { PlanCard } from "./SubscriptionManager";
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
      key: "free", name: "Free", price: PLAN_PRICES.free, current: currentPlan === "free",
      features: ["10 portfolio photos", "1 location", "Basic visibility", `${COMMISSION_RATES.free}% commission`],
    },
    {
      key: "pro", name: "Pro", price: PLAN_PRICES.pro, current: currentPlan === "pro",
      features: ["30 portfolio photos", "5 locations", "Priority ranking", "Profile analytics", `${COMMISSION_RATES.pro}% commission`],
    },
    {
      key: "premium", name: "Premium", price: PLAN_PRICES.premium, current: currentPlan === "premium",
      features: ["Unlimited photos", "All locations", "Top ranking", "Full analytics", `${COMMISSION_RATES.premium}% commission`, "Priority support"],
    },
  ];

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">Subscriptions</h1>
      <p className="mt-1 text-gray-500">Manage your plan, add-ons, and payments</p>

      {/* Plans with buttons inline */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.key} plan={plan} currentPlan={currentPlan} />
        ))}
      </div>

      {/* Add-ons: Verified & Featured */}
      <AddOnsSection
        isVerified={isVerified}
        isFeatured={isFeatured}
        phoneVerified={phoneVerified}
        phoneNumber={phoneNumber}
      />

    </div>
  );
}
