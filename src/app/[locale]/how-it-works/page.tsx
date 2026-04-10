import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HowItWorksSection } from "@/components/ui/HowItWorksSection";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "howItWorks.page" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/how-it-works", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/how-it-works` },
  };
}

const FAQ_KEYS = [
  "howFarInAdvance",
  "whatIfRains",
  "howReceivePhotos",
  "requestLocations",
  "whatToWear",
  "conciergeMatching",
] as const;

const TRAVELER_STEP_KEYS = [
  "browseCompare",
  "bookInstantly",
  "meetShoot",
  "getPhotos",
] as const;

const PHOTOGRAPHER_STEP_KEYS = [
  "createProfile",
  "getDiscovered",
  "growBusiness",
] as const;

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks.page");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("title"),
    description: t("metaDescription"),
    totalTime: "PT10M",
    estimatedCost: { "@type": "MonetaryAmount", currency: "EUR", value: "150" },
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: t("travelerSteps.browseCompare.title"),
        text: t("travelerSteps.browseCompare.text"),
        url: "https://photoportugal.com/choose-booking-type",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: t("travelerSteps.bookInstantly.title"),
        text: t("travelerSteps.bookInstantly.text"),
        url: "https://photoportugal.com/choose-booking-type",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: t("travelerSteps.meetShoot.title"),
        text: t("travelerSteps.meetShoot.text"),
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: t("travelerSteps.getPhotos.title"),
        text: t("travelerSteps.getPhotos.text"),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tn("howItWorks"), href: "/how-it-works" },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <HowItWorksSection />

      {/* For Travelers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("forTravelers")}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {TRAVELER_STEP_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-warm-200 bg-white p-8"
            >
              <h3 className="text-lg font-bold text-gray-900">
                {t(`travelerSteps.${key}.title`)}
              </h3>
              <p className="mt-2 text-gray-600">
                {t(`travelerSteps.${key}.text`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For Photographers */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-gray-900">
            {t("forPhotographers")}
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            {t("forPhotographersSubtitle")}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {PHOTOGRAPHER_STEP_KEYS.map((key) => (
              <div key={key}>
                <h3 className="text-lg font-bold text-gray-900">
                  {t(`photographerSteps.${key}.title`)}
                </h3>
                <p className="mt-2 text-gray-600">
                  {t(`photographerSteps.${key}.text`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/for-photographers/join"
              className="inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700"
            >
              {t("joinAsPhotographer")}
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          {t("faq.title")}
        </h2>
        <div className="mt-8 space-y-6">
          {FAQ_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-warm-200 bg-white p-6"
            >
              <h3 className="font-semibold text-gray-900">{t(`faq.${key}.q`)}</h3>
              <p className="mt-2 text-sm text-gray-600">{t(`faq.${key}.a`)}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-gray-500">
          {t.rich("helpCenterCta", {
            link: (chunks) => (
              <Link href="/support" className="font-semibold text-primary-600 hover:text-primary-700">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </>
  );
}
