import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "forPhotographers" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/for-photographers", locale),
  };
}

export default async function ForPhotographersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forPhotographers");
  const tc = await getTranslations("common");

  const steps = [
    { step: "1", key: "createProfile" as const },
    { step: "2", key: "getApproved" as const },
    { step: "3", key: "startBooking" as const },
  ];

  const benefits = [
    "clients",
    "payments",
    "management",
    "seo",
    "reviews",
    "pricing",
  ] as const;

  const faqItems = t.raw("faq.items") as Array<{ q: string; a: string }>;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("forPhotographers"), href: "/for-photographers" },
        ]}
      />
      {/* Hero */}
      <section className="bg-gray-900 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/for-photographers/join" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-base font-bold text-white hover:from-amber-600 hover:to-orange-600 shadow-lg">
              {t("joinEarlyBird")}
            </Link>
            <Link href="/for-photographers/pricing" className="rounded-xl border border-white/20 px-8 py-4 text-base font-semibold text-white hover:bg-white/5">
              {t("viewPlans")}
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            {t("earlyBirdNote")}
          </p>
        </div>
      </section>

      {/* How it works for photographers */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-center font-display text-3xl font-bold text-gray-900">{t("howItWorks.title")}</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600">
                {item.step}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{t(`howItWorks.${item.key}.title`)}</h3>
              <p className="mt-2 text-sm text-gray-500">{t(`howItWorks.${item.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-warm-200 bg-warm-50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900">{t("whyJoin.title")}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {benefits.map((key) => (
              <div key={key} className="rounded-xl border border-warm-200 bg-white p-6">
                <h3 className="font-semibold text-gray-900">{t(`whyJoin.benefits.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-gray-500">{t(`whyJoin.benefits.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community — Coming Soon */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-block rounded-full bg-accent-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-700">
            {t("community.badge")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900">
            {t("community.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            {t("community.description")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-warm-200 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-gray-900">{t("faq.title")}</h2>
          <div className="mt-10 space-y-4">
            {faqItems.map((item, i) => (
              <details key={i} className="group rounded-xl border border-warm-200 bg-white p-5 open:shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-gray-900 list-none">
                  <span>{item.q}</span>
                  <svg className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-gray-900">{t("cta.title")}</h2>
          <p className="mt-4 text-gray-500">{t("cta.subtitle")}</p>
          <Link href="/for-photographers/join" className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700">
            {t("cta.createProfile")}
          </Link>
          <p className="mt-6 text-sm text-gray-400">
            {t("helpCenterCta")}{" "}
            <Link href="/support" className="font-medium text-primary-600 hover:text-primary-700">
              {t("helpCenterLink")} &rarr;
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
