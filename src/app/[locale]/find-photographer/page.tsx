import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { FindPhotographerForm } from "@/components/ui/FindPhotographerForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "findPhotographer" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/find-photographer", locale),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: `https://photoportugal.com${locale === "en" ? "" : "/" + locale}/find-photographer` },
  };
}

export default async function FindPhotographerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const userInfo = userId ? await queryOne<{ name: string; email: string; phone: string | null }>(
    "SELECT name, email, phone FROM users WHERE id = $1", [userId]
  ) : null;

  const t = await getTranslations("findPhotographer");
  const tc = await getTranslations("common");

  return (
    <>
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: t("title"), href: "/find-photographer" },
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
          <FindPhotographerForm
            defaultName={userInfo?.name || ""}
            defaultEmail={userInfo?.email || ""}
            defaultPhone={userInfo?.phone || ""}
            userId={userId || undefined}
          />
        </div>

        {/* How It Works */}
        <div className="mt-16">
          <h2 className="text-center font-display text-2xl font-bold text-gray-900">
            {t("howItWorksTitle")}
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((step) => (
              <div key={step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600">
                  {step}
                </div>
                <h3 className="mt-4 text-sm font-bold text-gray-900">
                  {t(`step${step}Title` as "step1Title" | "step2Title" | "step3Title")}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {t(`step${step}Desc` as "step1Desc" | "step2Desc" | "step3Desc")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
