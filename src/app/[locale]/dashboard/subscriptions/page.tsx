import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { COMMISSION_RATES, PLAN_PRICES } from "@/lib/stripe";
import { PlanCard } from "./SubscriptionManager";
import { AddOnsSection } from "./AddOnsSection";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const t = await getTranslations("subscriptions");
  const locale = await getLocale();
  const dateLocale = locale === "pt" ? "pt-PT" : "en-US";
  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const profile = await queryOne<{
    plan: string; is_verified: boolean; is_featured: boolean;
    phone_number: string | null; phone_verified: boolean;
    is_founding: boolean; early_bird_tier: string | null; early_bird_expires_at: string | null;
  }>(
    "SELECT plan, is_verified, is_featured, phone_number, phone_verified, COALESCE(is_founding, FALSE) as is_founding, early_bird_tier, early_bird_expires_at FROM photographer_profiles WHERE user_id = $1",
    [userId]
  );

  const currentPlan = profile?.plan || "free";
  const isVerified = profile?.is_verified || false;
  const isFeatured = profile?.is_featured || false;
  const phoneVerified = profile?.phone_verified || false;
  const phoneNumber = profile?.phone_number || null;
  const isFounding = profile?.is_founding || false;
  const earlyBirdTier = profile?.early_bird_tier || null;
  const earlyBirdExpires = profile?.early_bird_expires_at || null;

  const plans = [
    {
      key: "free", name: t("planFree"), price: PLAN_PRICES.free, current: currentPlan === "free",
      features: [
        t("feat100Photos"), t("feat1Location"), t("featBasicVisibility"),
        t("featCommission", { rate: COMMISSION_RATES.free }),
      ],
    },
    {
      key: "pro", name: t("planPro"), price: PLAN_PRICES.pro, current: currentPlan === "pro",
      features: [
        t("feat100Photos"), t("feat5Locations"), t("featPriorityRanking"),
        t("featAnalytics"), t("featCommission", { rate: COMMISSION_RATES.pro }),
      ],
    },
    {
      key: "premium", name: t("planPremium"), price: PLAN_PRICES.premium, current: currentPlan === "premium",
      features: [
        t("feat100Photos"), t("featAllLocations"), t("featTopRanking"),
        t("featFullAnalytics"), t("featCustomUrl"), t("featCommission", { rate: COMMISSION_RATES.premium }),
        t("featPrioritySupport"),
      ],
    },
  ];

  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const earlyBirdBannerText = isFounding
    ? t("foundingPlanFree", { plan: planLabel })
    : t("earlyBirdPlanFree", {
        plan: planLabel,
        date: new Date(earlyBirdExpires!).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" }),
      });

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-gray-500">{t("subtitle")}</p>

      {/* Early bird banner */}
      {earlyBirdTier && (
        <div className={`mt-6 rounded-xl border p-5 ${isFounding ? "border-amber-200 bg-amber-50" : "border-primary-200 bg-primary-50"}`}>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${isFounding ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-primary-600"}`}>
              {isFounding ? t("foundingPhotographer") : earlyBirdTier === "early50" ? t("earlyAdopter") : t("first50")}
            </span>
          </div>
          <p className={`mt-2 text-sm font-medium ${isFounding ? "text-amber-800" : "text-primary-800"}`}>
            {earlyBirdBannerText}
          </p>
        </div>
      )}

      {/* Plans with buttons inline */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.key} plan={plan} currentPlan={currentPlan} earlyBirdActive={!!earlyBirdTier} />
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
