import { Link } from "@/i18n/navigation";
import { queryOne } from "@/lib/db";
import { StripeLogo } from "@/components/ui/StripeLogo";
import { EarlyBirdCounter } from "./EarlyBirdCounter";
import { EarningsCalculator } from "./EarningsCalculator";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { COMMISSION_RATES, PLAN_PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "join" });
  return {
    title: t("heroTitle") + " — Photo Portugal",
    description: t("heroSubtitle"),
    alternates: localeAlternates("/join", locale),
    openGraph: {
      title: t("heroTitle") + " — Photo Portugal",
      description: t("heroSubtitle"),
      url: "https://photoportugal.com/join",
      images: ["/og-image.png"],
    },
  };
}

const TIER_KEYS = ["founding", "early50", "first100"] as const;

const TIER_CONFIG = [
  { key: "founding" as const, spots: 10, color: "from-amber-500 to-orange-500", textColor: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  { key: "early50" as const, spots: 25, color: "from-primary-500 to-primary-700", textColor: "text-primary-700", bgColor: "bg-primary-50", borderColor: "border-primary-200" },
  { key: "first100" as const, spots: 50, color: "from-accent-500 to-accent-700", textColor: "text-accent-700", bgColor: "bg-accent-50", borderColor: "border-accent-200" },
];

export default async function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("join");
  const tc = await getTranslations("common");

  let totalPhotographers = 0;
  try {
    const row = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.registration_number > 0 AND pp.is_test = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE");
    totalPhotographers = parseInt(row?.count || "0");
  } catch {}

  // Determine which tier is active
  let activeTierIndex = -1;
  const thresholds = [10, 35, 60];
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

  const whatYouGetItems = [
    { key: "touristClients" as const, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    { key: "securePayments" as const, icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { key: "portfolioProfile" as const, icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { key: "bookingManagement" as const, icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { key: "photoDelivery" as const, icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
    { key: "verifiedReviews" as const, icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  ];

  const paymentSteps = [
    { key: "clientBooks" as const, color: "bg-primary-500" },
    { key: "youShoot" as const, color: "bg-accent-500" },
    { key: "youDeliver" as const, color: "bg-yellow-500" },
    { key: "youGetPaid" as const, color: "bg-green-500" },
  ];

  const gettingStartedSteps = [
    "createAccount",
    "setupProfile",
    "uploadPortfolio",
    "createPackages",
    "connectStripe",
    "getApproved",
  ] as const;

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
            {t("badge")}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            {activeTierIndex === 0 ? t("heroTitle") : activeTierIndex === 1 ? t("heroTitleEarly") : activeTierIndex === 2 ? t("heroTitleFirst") : t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            {t("heroSubtitle")}
          </p>

          {/* Live counter */}
          <EarlyBirdCounter totalPhotographers={totalPhotographers} />

          <div className="mt-10">
            <Link
              href="/auth/signup?role=photographer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-10 py-4 text-base font-bold text-white shadow-lg transition hover:from-amber-600 hover:to-orange-600 hover:shadow-xl"
            >
              {t("claimYourSpot")}
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
          <h2 className="font-display text-3xl font-bold text-gray-900">{t("tiers.title")}</h2>
          <p className="mt-3 text-gray-500">{t("tiers.subtitle")}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TIER_CONFIG.map((tier, i) => {
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
                    {tc("nowOpen")}
                  </span>
                )}
                {isFilled && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-400 px-4 py-1 text-xs font-bold text-white">
                    {tc("filled")}
                  </span>
                )}

                <h3 className={`text-xl font-bold ${isActive ? tier.textColor : "text-gray-900"}`}>
                  {t(`tiers.${tier.key}.label`)}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{tier.spots} {tc("spots")}</p>

                <div className="mt-4">
                  <p className={`text-lg font-bold ${isActive ? tier.textColor : "text-gray-900"}`}>
                    {t(`tiers.${tier.key}.reward`)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{t(`tiers.${tier.key}.rewardDetail`)}</p>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{spotsUsed} {tc("joined")}</span>
                    <span>{isFilled ? tc("full") : `${spotsLeft} ${tc("left")}`}</span>
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
            <h2 className="font-display text-3xl font-bold text-gray-900">{t("whatYouGet.title")}</h2>
            <p className="mt-3 text-gray-500">{t("whatYouGet.subtitle")}</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {whatYouGetItems.map((item) => (
              <div key={item.key} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                  <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t(`whatYouGet.${item.key}.title`)}</h3>
                  <p className="mt-1 text-sm text-gray-500">{t(`whatYouGet.${item.key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Payments Work — for photographers */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900">{t("howPaymentsWork.title")}</h2>
          <div className="mt-3 flex items-center justify-center gap-2 text-gray-500">
            <span>{t("howPaymentsWork.subtitle")}</span>
          </div>
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500">
              <StripeLogo className="h-[14px] w-auto text-[#635BFF]" />
            </span>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-0 sm:grid-cols-4">
          {paymentSteps.map((item, i) => (
            <div key={item.key} className="relative flex flex-col items-center text-center px-4 py-6">
              {i < 3 && (
                <div className="absolute right-0 top-1/2 hidden h-0.5 w-8 -translate-y-1/2 bg-warm-300 sm:block" style={{ right: "-16px" }} />
              )}
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.color} text-sm font-bold text-white shadow-md`}>
                {i + 1}
              </div>
              <h3 className="mt-3 text-sm font-bold text-gray-900">{t(`howPaymentsWork.steps.${item.key}.title`)}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{t(`howPaymentsWork.steps.${item.key}.desc`)}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-accent-200 bg-accent-50/50 p-5 text-center">
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">{t("howPaymentsWork.noUpfrontCosts")}</strong> {t("howPaymentsWork.commissionNote")}
          </p>
        </div>
      </section>

      {/* Commission transparency */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900">{t("transparentPricing.title")}</h2>
          <p className="mt-3 text-gray-500">{t("transparentPricing.subtitle")}</p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-warm-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50">
                <th className="px-6 py-4 text-left font-semibold text-gray-900">{t("transparentPricing.table.plan")}</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">{t("transparentPricing.table.monthly")}</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">{t("transparentPricing.table.commission")}</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900">{t("transparentPricing.table.youEarn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              <tr>
                <td className="px-6 py-4 font-medium text-gray-900">Free</td>
                <td className="px-6 py-4 text-gray-500">&euro;{PLAN_PRICES.free}</td>
                <td className="px-6 py-4 text-gray-500">{COMMISSION_RATES.free}%</td>
                <td className="px-6 py-4 font-semibold text-gray-900">&euro;{200 - 200 * COMMISSION_RATES.free / 100}</td>
              </tr>
              <tr className="bg-primary-50/50">
                <td className="px-6 py-4 font-medium text-primary-700">Pro</td>
                <td className="px-6 py-4 text-gray-500">&euro;{PLAN_PRICES.pro}</td>
                <td className="px-6 py-4 text-gray-500">{COMMISSION_RATES.pro}%</td>
                <td className="px-6 py-4 font-semibold text-primary-700">&euro;{200 - 200 * COMMISSION_RATES.pro / 100}</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-medium text-gray-900">Premium</td>
                <td className="px-6 py-4 text-gray-500">&euro;{PLAN_PRICES.premium}</td>
                <td className="px-6 py-4 text-gray-500">{COMMISSION_RATES.premium}%</td>
                <td className="px-6 py-4 font-semibold text-gray-900">&euro;{200 - 200 * COMMISSION_RATES.premium / 100}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-sm text-gray-400">
          {t("transparentPricing.earlyBirdNote")}
        </p>
      </section>

      {/* Earnings Calculator */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-gray-900">{t("calculator.title")}</h2>
          <p className="mt-3 text-gray-500">{t("calculator.subtitle")}</p>
        </div>
        <EarningsCalculator />
      </section>

      {/* Founder testimonial */}
      <section className="border-y border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col items-center text-center">
            <img
              src="/api/img/avatars/686ad75a-fa5b-4dcb-bdd7-7ec30d9e8910.jpg?w=160&q=85&f=webp"
              alt="Kate Belova, founder of Photo Portugal"
              className="h-20 w-20 rounded-full object-cover"
            />
            <blockquote className="mt-6 text-lg leading-relaxed text-gray-700 italic max-w-xl">
              &ldquo;I built Photo Portugal because I know how hard it is for talented photographers to find consistent clients. This platform brings tourists directly to you — no chasing leads, no haggling over prices. You focus on what you love: creating beautiful photos.&rdquo;
            </blockquote>
            <p className="mt-4 font-semibold text-gray-900">Kate Belova</p>
            <p className="text-sm text-gray-500">Founder &amp; Photographer, 10+ years experience</p>
            <Link href="/photographers/kate-belova" className="mt-2 text-xs text-primary-600 hover:underline">
              View Kate&apos;s profile →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900">{t("gettingStarted.title")}</h2>
          </div>

          <div className="mt-12 space-y-6">
            {gettingStartedSteps.map((stepKey, i) => (
              <div key={stepKey} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t(`gettingStarted.steps.${stepKey}.title`)}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">{t(`gettingStarted.steps.${stepKey}.desc`)}</p>
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
            {t("finalCta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
            {t("finalCta.subtitle")}
          </p>
          <div className="mt-8">
            <Link
              href="/auth/signup?role=photographer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-10 py-4 text-base font-bold text-white shadow-lg transition hover:from-amber-600 hover:to-orange-600"
            >
              {t("claimYourSpotNow")}
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">{t("finalCta.freeToSignUp")}</p>
        </div>
      </section>
    </>
  );
}
