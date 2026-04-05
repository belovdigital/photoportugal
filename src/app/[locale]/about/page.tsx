import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/about", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/about` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tc = await getTranslations("common");

  const trustPoints = [
    {
      key: "realReviews" as const,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    },
    {
      key: "verifiedPhotographers" as const,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    },
    {
      key: "securePayments" as const,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    },
    {
      key: "locationsCovered" as const,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Photo Portugal",
            url: "https://photoportugal.com",
            logo: "https://photoportugal.com/logo.svg",
            description:
              "Photo Portugal connects tourists visiting Portugal with talented local photographers for professional vacation photoshoots.",
            founder: {
              "@type": "Person",
              name: "Kate Belova",
              jobTitle: "Founder & Photographer",
              url: "https://photoportugal.com/photographers/kate-belova",
            },
            contactPoint: {
              "@type": "ContactPoint",
              email: "info@photoportugal.com",
              contactType: "customer service",
            },
          }),
        }}
      />

      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: tc("about"), href: "/about" },
        ]}
      />
      {/* Hero */}
      <section className="bg-warm-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {t("heroTitle")} <span className="text-primary-600">{t("heroTitleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-500">
            {t("heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="space-y-8 text-gray-600 leading-relaxed">
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">{t("theProblem.title")}</h2>
            <p className="mt-4">
              {t("theProblem.text")}
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">{t("ourMission.title")}</h2>
            <p className="mt-4">
              {t("ourMission.text1")}
            </p>
            <p className="mt-4">
              {t("ourMission.text2")}
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">{t("howItWorks.title")}</h2>
            <p className="mt-4">
              {t("howItWorks.text")}
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">{t("whatMakesUsDifferent.title")}</h2>
          </div>
        </div>

        {/* Trust points */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {trustPoints.map((item) => (
            <div key={item.key} className="rounded-2xl border border-warm-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
              </div>
              <h3 className="mt-3 font-bold text-gray-900">
                {item.key === "locationsCovered"
                  ? t(`trustPoints.${item.key}.title`, { count: locations.length })
                  : t(`trustPoints.${item.key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{t(`trustPoints.${item.key}.text`)}</p>
            </div>
          ))}
        </div>

        {/* Founder */}
        <div className="mt-16 rounded-2xl border border-warm-200 bg-white p-8">
          <h2 className="font-display text-2xl font-bold text-gray-900">Meet the Founder</h2>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <Link href="/photographers/kate-belova" className="shrink-0">
              <img
                src="/api/img/avatars/686ad75a-fa5b-4dcb-bdd7-7ec30d9e8910.jpg?w=200&q=85&f=webp"
                alt="Kate Belova, founder of Photo Portugal"
                className="h-28 w-28 rounded-2xl object-cover"
              />
            </Link>
            <div className="space-y-3 text-gray-600 leading-relaxed">
              <p>
                <strong className="text-gray-900">Kate Belova</strong>{" "}is a professional portrait and lifestyle photographer with over 10 years of experience, based in Lisbon, Portugal. Known for her &ldquo;soul portrait&rdquo; style, Kate has a rare ability to make people feel completely at ease in front of the camera — revealing authentic emotions and genuine personality in every frame.
              </p>
              <p>
                After years of shooting family and lifestyle sessions across Lisbon, Sintra, and Cascais, Kate realized that tourists visiting Portugal wanted beautiful photos but finding a trustworthy local photographer was surprisingly hard. She created Photo Portugal to solve this — a curated marketplace where every photographer is personally vetted and every session delivers an exceptional experience.
              </p>
              <p>
                Kate personally oversees the <Link href="/for-photographers/how-we-select" className="text-primary-600 hover:underline">photographer selection process</Link>, ensuring that only professionals who share her commitment to authenticity and quality join the platform.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 text-gray-500">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/photographers"
              className="rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              {t("findAPhotographer")}
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-xl border border-primary-200 px-8 py-3.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              {t("seeHowItWorks")}
            </Link>
          </div>

          <p className="mt-8 text-sm text-gray-400">
            {t("questionsEmail")}{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-500 hover:underline">
              info@photoportugal.com
            </a>
          </p>
        </div>
      </section>

    </>
  );
}
