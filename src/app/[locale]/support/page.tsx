import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { SupportContent } from "@/components/support/SupportContent";
import { localeAlternates } from "@/lib/seo";

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "supportPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/support", locale),
  };
}

/* ------------------------------------------------------------------ */
/*  Article key definitions                                           */
/* ------------------------------------------------------------------ */

const CLIENT_ARTICLE_KEYS = [
  "howToBook",
  "paymentProtection",
  "cancelReschedule",
  "noShow",
  "receivePhotos",
  "notHappy",
  "paymentReleased",
] as const;

const PHOTOGRAPHER_ARTICLE_KEYS = [
  "getStarted",
  "subscriptionPlans",
  "getPaid",
  "clientCancels",
  "deliverPhotos",
  "photographerCancels",
  "externalLinks",
] as const;

const PAYMENTS_ARTICLE_KEYS = [
  "escrowSystem",
  "serviceFees",
  "refundPolicy",
  "disputes",
] as const;

const GENERAL_ARTICLE_KEYS = [
  "rainPolicy",
  "forcesMajeure",
  "contactSupport",
] as const;

/* ------------------------------------------------------------------ */
/*  Icons (heroicons outline, 20x20 viewBox)                          */
/* ------------------------------------------------------------------ */

function ClientsIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

function PhotographersIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
      />
    </svg>
  );
}

function PaymentsIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function GeneralIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("supportPage");
  const tc = await getTranslations("common");

  /* Build category data from translations */
  const categories = [
    {
      id: "for-clients",
      title: t("categories.clients.title"),
      description: t("categories.clients.description"),
      icon: <ClientsIcon />,
      articles: CLIENT_ARTICLE_KEYS.map((key) => ({
        id: `client-${key}`,
        question: t(`articles.clients.${key}.question`),
        answer: t(`articles.clients.${key}.answer`),
      })),
    },
    {
      id: "for-photographers",
      title: t("categories.photographers.title"),
      description: t("categories.photographers.description"),
      icon: <PhotographersIcon />,
      articles: PHOTOGRAPHER_ARTICLE_KEYS.map((key) => ({
        id: `photographer-${key}`,
        question: t(`articles.photographers.${key}.question`),
        answer: t(`articles.photographers.${key}.answer`),
      })),
    },
    {
      id: "payments-protection",
      title: t("categories.payments.title"),
      description: t("categories.payments.description"),
      icon: <PaymentsIcon />,
      articles: PAYMENTS_ARTICLE_KEYS.map((key) => ({
        id: `payments-${key}`,
        question: t(`articles.payments.${key}.question`),
        answer: t(`articles.payments.${key}.answer`),
      })),
    },
    {
      id: "general",
      title: t("categories.general.title"),
      description: t("categories.general.description"),
      icon: <GeneralIcon />,
      articles: GENERAL_ARTICLE_KEYS.map((key) => ({
        id: `general-${key}`,
        question: t(`articles.general.${key}.question`),
        answer: t(`articles.general.${key}.answer`),
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-warm-50">
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: t("breadcrumb"), href: "/support" },
        ]}
      />

      {/* Hero */}
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Category cards — quick navigation */}
      <section className="mx-auto -mt-8 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="group flex flex-col items-center rounded-xl border border-warm-200 bg-white px-6 py-8 text-center shadow-sm transition hover:border-primary-300 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700 transition group-hover:bg-primary-200">
                {cat.icon}
              </span>
              <h2 className="mt-4 font-semibold text-gray-900">
                {cat.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{cat.description}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Interactive content: search + sidebar + articles */}
      <SupportContent
        categories={categories}
        searchPlaceholder={t("searchPlaceholder")}
        searchNoResults={t("searchNoResults")}
        onThisPage={t("onThisPage")}
      />

      {/* Bottom CTA */}
      <section className="border-t border-warm-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-gray-900">
            {t("cta.title")}
          </h2>
          <p className="mt-3 text-gray-500">{t("cta.description")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-primary-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
              {t("cta.contactButton")}
            </Link>
            <a
              href="/faq"
              className="inline-flex items-center gap-2 rounded-xl border border-warm-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-warm-50"
            >
              {t("cta.faqButton")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
