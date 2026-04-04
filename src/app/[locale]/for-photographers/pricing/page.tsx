import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { COMMISSION_RATES, SERVICE_FEE_RATE, PLAN_PRICES } from "@/lib/stripe";
import { StripeLogo } from "@/components/ui/StripeLogo";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pricing" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/for-photographers/pricing", locale),
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");

  const plans = [
    {
      key: "free" as const,
      price: String(PLAN_PRICES.free),
      features: [
        t("plans.free.features.portfolioPhotos"),
        t("plans.free.features.locations"),
        t("plans.free.features.searchVisibility"),
        t("plans.free.features.commission", { rate: COMMISSION_RATES.free }),
      ],
      href: "/for-photographers/join",
      highlighted: false,
    },
    {
      key: "pro" as const,
      price: String(PLAN_PRICES.pro),
      features: [
        t("plans.pro.features.portfolioPhotos"),
        t("plans.pro.features.locations"),
        t("plans.pro.features.searchRanking"),
        t("plans.pro.features.analytics"),
        t("plans.pro.features.commission", { rate: COMMISSION_RATES.pro }),
      ],
      href: "/dashboard/subscriptions",
      highlighted: false,
    },
    {
      key: "premium" as const,
      price: String(PLAN_PRICES.premium),
      features: [
        t("plans.premium.features.portfolioPhotos"),
        t("plans.premium.features.locations"),
        t("plans.premium.features.searchRanking"),
        t("plans.premium.features.analytics"),
        t("plans.premium.features.customUrl"),
        t("plans.premium.features.commission", { rate: COMMISSION_RATES.premium }),
        t("plans.premium.features.support"),
      ],
      href: "/dashboard/subscriptions",
      highlighted: true,
    },
  ];

  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: [
      {
        "@type": "Offer",
        name: "Free Plan",
        price: "0",
        priceCurrency: "EUR",
        description: `10 portfolio images, ${COMMISSION_RATES.free}% commission`,
      },
      {
        "@type": "Offer",
        name: "Pro Plan",
        price: String(PLAN_PRICES.pro),
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          billingDuration: "P1M",
        },
        description: `30 portfolio images, ${COMMISSION_RATES.pro}% commission`,
      },
      {
        "@type": "Offer",
        name: "Premium Plan",
        price: String(PLAN_PRICES.premium),
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          billingDuration: "P1M",
        },
        description: `100 portfolio images, ${COMMISSION_RATES.premium}% commission`,
      },
    ],
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
    />
    <Breadcrumbs
      items={[
        { name: tc("home"), href: "/" },
        { name: tc("pricing"), href: "/for-photographers/pricing" },
      ]}
    />
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-gray-900">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className={`relative rounded-2xl border p-8 ${
              plan.highlighted
                ? "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200 shadow-lg"
                : "border-warm-200 bg-white"
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-xs font-bold text-white shadow">
                {tc("mostPopular")}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900">{t(`plans.${plan.key}.name`)}</h2>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">&euro;{plan.price}</span>
              {plan.price !== "0" && <span className="text-gray-500">{tc("perMonth")}</span>}
            </div>
            <p className="mt-2 text-sm text-gray-500">{t(`plans.${plan.key}.description`)}</p>
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
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t(`plans.${plan.key}.cta`)}
            </Link>
          </div>
        ))}
      </div>

      {/* Add-ons */}
      <div className="mt-12">
        <h2 className="text-center font-display text-2xl font-bold text-gray-900">{t("addOns.title")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("addOns.verifiedBadge.title")}</h3>
                <p className="text-sm text-gray-500">{t("addOns.verifiedBadge.subtitle")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {t("addOns.verifiedBadge.description")}
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{t("addOns.verifiedBadge.price")}</p>
          </div>

          <div className="rounded-xl border border-warm-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t("addOns.featuredPlacement.title")}</h3>
                <p className="text-sm text-gray-500">{t("addOns.featuredPlacement.subtitle")}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {t("addOns.featuredPlacement.description")}
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{t("addOns.featuredPlacement.price")}</p>
          </div>
        </div>
      </div>

      {/* All plans include */}
      <div className="mt-12 rounded-xl bg-warm-50 p-8">
        <h3 className="text-center text-lg font-bold text-gray-900">{t("allPlansInclude.title")}</h3>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {[
            { icon: "\uD83D\uDCC5", labelKey: "bookingManagement" },
            { icon: "\uD83D\uDCAC", labelKey: "clientMessaging" },
            { icon: "\u2B50", labelKey: "verifiedReviews" },
            { icon: "\uD83D\uDCB3", labelKey: "stripePayments" },
            { icon: "\uD83D\uDD0D", labelKey: "seoProfile" },
          ].map((item) => (
            <div key={item.labelKey} className="text-center">
              <span className="text-2xl">{item.icon}</span>
              <p className="mt-1 text-sm text-gray-600">{t(`allPlansInclude.${item.labelKey}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Commission breakdown */}
      <div className="mt-8 rounded-xl border border-warm-200 bg-white p-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-bold text-gray-900">{t("howPaymentsWork.title")}</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
            <StripeLogo className="h-[14px] w-auto text-[#635BFF]" />
          </span>
        </div>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t("howPaymentsWork.forClients.title")}</p>
            <p className="mt-1 text-sm text-gray-500">
              {t("howPaymentsWork.forClients.description", { rate: SERVICE_FEE_RATE * 100 })}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t("howPaymentsWork.forPhotographers.title")}</p>
            <p className="mt-1 text-sm text-gray-500">
              {t("howPaymentsWork.forPhotographers.description")}
            </p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-warm-200">
                <th className="pb-2 text-left font-medium text-gray-500">{t("howPaymentsWork.table.examplePackage")}</th>
                <th className="pb-2 text-right font-medium text-gray-500">Free</th>
                <th className="pb-2 text-right font-medium text-gray-500">Pro</th>
                <th className="pb-2 text-right font-medium text-gray-500">Premium</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr><td className="py-1">{t("howPaymentsWork.table.clientPays")}</td><td className="py-1 text-right">&euro;330</td><td className="py-1 text-right">&euro;330</td><td className="py-1 text-right">&euro;330</td></tr>
              <tr><td className="py-1">{t("howPaymentsWork.table.serviceFee", { rate: SERVICE_FEE_RATE * 100 })}</td><td className="py-1 text-right">&euro;{300 * SERVICE_FEE_RATE}</td><td className="py-1 text-right">&euro;{300 * SERVICE_FEE_RATE}</td><td className="py-1 text-right">&euro;{300 * SERVICE_FEE_RATE}</td></tr>
              <tr><td className="py-1">{t("howPaymentsWork.table.platformCommission")}</td><td className="py-1 text-right text-red-500">-&euro;{300 * COMMISSION_RATES.free / 100} ({COMMISSION_RATES.free}%)</td><td className="py-1 text-right text-red-500">-&euro;{300 * COMMISSION_RATES.pro / 100} ({COMMISSION_RATES.pro}%)</td><td className="py-1 text-right text-red-500">-&euro;{300 * COMMISSION_RATES.premium / 100} ({COMMISSION_RATES.premium}%)</td></tr>
              <tr className="border-t border-warm-200 font-semibold text-gray-900"><td className="pt-2">{t("howPaymentsWork.table.youReceive")}</td><td className="pt-2 text-right text-accent-600">&euro;{300 - 300 * COMMISSION_RATES.free / 100}</td><td className="pt-2 text-right text-accent-600">&euro;{300 - 300 * COMMISSION_RATES.pro / 100}</td><td className="pt-2 text-right text-accent-600">&euro;{300 - 300 * COMMISSION_RATES.premium / 100}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-right text-xs text-gray-400">
          <Link href="/support" className="hover:text-primary-600">
            {t("helpCenterLink")} {t("helpCenterLinkText")} &rarr;
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}
