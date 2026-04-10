import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("chooseBookingType");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/choose-booking-type", locale),
  };
}

export default async function ChooseBookingTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ location?: string; shootType?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { location, shootType } = await searchParams;

  const t = await getTranslations("chooseBookingType");
  const tc = await getTranslations("common");

  // Build query string to forward
  const qs = new URLSearchParams();
  if (location) qs.set("location", location);
  if (shootType) qs.set("shootType", shootType);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const breadcrumbs = [
    { name: tc("home"), href: "/" },
    { name: t("metaTitle"), href: "/choose-booking-type" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-8 text-center">
        <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {/* Card 1: Browse & Choose */}
        <Link
          href={`/photographers${suffix}`}
          className="group flex flex-col rounded-2xl border-2 border-warm-200 p-8 transition hover:border-primary-300 hover:shadow-lg"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            {/* Camera icon */}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-primary-600 transition">
            {t("browseTitle")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {t("browseDesc")}
          </p>
          <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600">
            {t("browseCta")}
            <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>

        {/* Card 2: Concierge Match */}
        <Link
          href={`/find-photographer${suffix}`}
          className="group flex flex-col rounded-2xl border-2 border-warm-200 p-8 transition hover:border-accent-300 hover:shadow-lg"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
            {/* Sparkles icon */}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-accent-600 transition">
            {t("matchTitle")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {t("matchDesc")}
          </p>
          <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-600">
            {t("matchCta")}
            <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}
