import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { locations } from "@/lib/locations-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "faq" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/faq", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/faq` },
  };
}

const FAQ_KEYS = [
  "howDoesItWork",
  "cost",
  "howToBook",
  "conciergeMatching",
  "paymentSecure",
  "cancelBooking",
  "reschedule",
  "photographerCancels",
  "deliveryTime",
  "notHappy",
  "galleryAccess",
  "rain",
  "reviewsVerified",
  "locationsAvailable",
  "speakEnglish",
  "becomePhotographer",
  "photographerPlans",
  "earlyBird",
  "clientNoShow",
  "photographerNoShow",
  "whenMoneyReleased",
  "forceMajeure",
  "lateDelivery",
] as const;

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const tc = await getTranslations("common");

  const faqs = FAQ_KEYS.map((key) => ({
    question: t(`questions.${key}.question`),
    answer: t(`questions.${key}.answer`, { locationCount: locations.length }),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("faq"), href: "/faq" },
        ]}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gray-900">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-warm-200 bg-white"
            >
              <summary className="flex items-center justify-between px-6 py-5 font-semibold text-gray-900">
                {faq.question}
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5">
                <p className="text-gray-600 leading-relaxed [&_a]:text-primary-600 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary-700" dangerouslySetInnerHTML={{ __html: faq.answer }} />
              </div>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-xl bg-warm-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            {t("helpCenterCta")}{" "}
            <Link href="/support" className="font-semibold text-primary-600 hover:text-primary-700">
              {t("helpCenterCtaLink")} &rarr;
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
