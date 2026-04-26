import { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forPhotographers.howWeSelect" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/for-photographers/how-we-select", locale),
  };
}

export default async function HowWeSelectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forPhotographers.howWeSelect");

  const stepKeys = ["portfolio", "social", "conversation", "onboarding", "monitoring"] as const;
  const stepIcons: Record<string, string> = {
    portfolio: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    social: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    conversation: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    onboarding: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    monitoring: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t("metaTitle"),
    description: t("metaDescription"),
    url: `https://photoportugal.com/${locale === "en" ? "" : locale + "/"}for-photographers/how-we-select`,
    publisher: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="font-display text-4xl font-bold text-gray-900 text-center">
        {t("title")}
      </h1>
      <p className="mt-4 text-center text-lg text-gray-500">
        {t("subtitle")}
      </p>

      <div className="mt-12 space-y-8">
        {stepKeys.map((key, i) => (
          <div key={key} className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
              <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={stepIcons[key]} />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                <span className="mr-2 text-primary-600">{t("stepLabel", { n: i + 1 })}</span>
                {t(`steps.${key}.title`)}
              </h2>
              <p className="mt-1.5 text-gray-600 leading-relaxed">{t(`steps.${key}.desc`)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl bg-warm-50 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {t("founderHeading")}
        </h2>
        <p className="mt-3 text-gray-600 leading-relaxed max-w-xl mx-auto">
          {t("founderBody")}
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/photographers" className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
            {t("browseCta")}
          </Link>
          <Link href="/about" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            {t("aboutCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
