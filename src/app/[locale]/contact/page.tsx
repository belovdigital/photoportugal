import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { ContactForm } from "@/components/ui/ContactForm";
import { Suspense } from "react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/contact", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `https://photoportugal.com${locale === "pt" ? "/pt" : ""}/contact` },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const tc = await getTranslations("common");

  return (
    <>
    <Breadcrumbs
      items={[
        { name: tc("home"), href: "/" },
        { name: tc("contact"), href: "/contact" },
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

      <div className="mt-12">
        <Suspense>
          <ContactForm />
        </Suspense>
      </div>

      <div className="mt-12 rounded-xl bg-warm-50 p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900">{t("responseTime.title")}</h2>
        <p className="mt-2 text-gray-500">
          {t("responseTime.description")}
        </p>
        <p className="mt-4 text-sm text-gray-500">
          {t("helpCenterNote")}{" "}
          <Link href="/support" className="font-semibold text-primary-600 hover:text-primary-700">
            {t("helpCenterLink")} &rarr;
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}
