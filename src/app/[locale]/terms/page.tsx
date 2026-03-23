import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tc = await getTranslations("common");
  const tt = await getTranslations("terms");
  return {
    title: tc("termsOfService"),
    description: tt("metaDescription"),
    alternates: localeAlternates("/terms", locale),
    robots: { index: false, follow: true },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-4 text-sm text-gray-400">{t("lastUpdated")}</p>

      <div className="mt-8 space-y-10 text-gray-600 leading-relaxed">

        {/* 1. Overview */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.overview.title")}</h2>
          <p className="mt-3">{t("sections.overview.content")}</p>
        </section>

        {/* 2. Accounts */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.accounts.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.accounts.items.accurate")}</li>
            <li>{t("sections.accounts.items.security")}</li>
            <li>{t("sections.accounts.items.oneAccount")}</li>
            <li>{t("sections.accounts.items.age")}</li>
          </ul>
        </section>

        {/* 3. For Clients */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.forClients.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.forClients.items.confirmation")}</li>
            <li>{t("sections.forClients.items.payment")}</li>
            <li>{t("sections.forClients.items.showUp")}</li>
            <li>{t("sections.forClients.items.reviews")}</li>
            <li>{t("sections.forClients.items.commercial")}</li>
          </ul>
        </section>

        {/* 4. For Photographers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.forPhotographers.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.forPhotographers.items.skills")}</li>
            <li>{t("sections.forPhotographers.items.portfolio")}</li>
            <li>{t("sections.forPhotographers.items.response")}</li>
            <li>{t("sections.forPhotographers.items.delivery")}</li>
            <li>{t("sections.forPhotographers.items.taxes")}</li>
            <li>{t("sections.forPhotographers.items.subscription")}</li>
          </ul>
        </section>

        {/* 5. Payments & Escrow */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.paymentsEscrow.title")}</h2>
          <p className="mt-3">{t("sections.paymentsEscrow.intro")}</p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.paymentsEscrow.items.clientPays")}</li>
            <li>{t("sections.paymentsEscrow.items.fundsHeld")}</li>
            <li>{t("sections.paymentsEscrow.items.released")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("sections.paymentsEscrow.items.autoRelease") }} />
            <li>{t("sections.paymentsEscrow.items.support")}</li>
          </ul>
        </section>

        {/* 6. Platform Commission */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.commission.title")}</h2>
          <p className="mt-3">{t("sections.commission.intro")}</p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t("sections.commission.items.free") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.commission.items.pro") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.commission.items.premium") }} />
          </ul>
          <p className="mt-3">{t("sections.commission.details")}</p>
        </section>

        {/* 7. Cancellation by Client */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.cancellationByClient.title")}</h2>
          <p className="mt-3">{t("sections.cancellationByClient.intro")}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-warm-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">{t("sections.cancellationByClient.table.headerWhen")}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">{t("sections.cancellationByClient.table.headerRefund")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                <tr><td className="px-4 py-3">{t("sections.cancellationByClient.table.row1When")}</td><td className="px-4 py-3 font-medium text-accent-600">{t("sections.cancellationByClient.table.row1Refund")}</td></tr>
                <tr><td className="px-4 py-3">{t("sections.cancellationByClient.table.row2When")}</td><td className="px-4 py-3 font-medium text-yellow-600">{t("sections.cancellationByClient.table.row2Refund")}</td></tr>
                <tr><td className="px-4 py-3">{t("sections.cancellationByClient.table.row3When")}</td><td className="px-4 py-3 font-medium text-red-600">{t("sections.cancellationByClient.table.row3Refund")}</td></tr>
                <tr><td className="px-4 py-3">{t("sections.cancellationByClient.table.row4When")}</td><td className="px-4 py-3 font-medium text-red-600">{t("sections.cancellationByClient.table.row4Refund")}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-500">{t("sections.cancellationByClient.note")}</p>
        </section>

        {/* 8. Cancellation by Photographer */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.cancellationByPhotographer.title")}</h2>
          <p className="mt-3" dangerouslySetInnerHTML={{ __html: t("sections.cancellationByPhotographer.intro") }} />
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.cancellationByPhotographer.items.replacement")}</li>
            <li>{t("sections.cancellationByPhotographer.items.repeated")}</li>
          </ul>
        </section>

        {/* 9. Rescheduling */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.rescheduling.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t("sections.rescheduling.items.free") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.rescheduling.items.late") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.rescheduling.items.weather") }} />
          </ul>
        </section>

        {/* 10. Photo Delivery */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.photoDelivery.title")}</h2>
          <p className="mt-3">{t("sections.photoDelivery.intro")}</p>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.photoDelivery.items.gallery")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("sections.photoDelivery.items.latePartial") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.photoDelivery.items.lateFullRefund") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.photoDelivery.items.acceptance") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.photoDelivery.items.autoRelease") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.photoDelivery.items.galleryAccess") }} />
          </ul>
        </section>

        {/* 11. Disputes & Quality Guarantee */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.disputes.title")}</h2>
          <p className="mt-3" dangerouslySetInnerHTML={{ __html: t("sections.disputes.intro") }} />
          <p className="mt-3 font-medium text-gray-900">{t("sections.disputes.groundsTitle")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>{t("sections.disputes.grounds.fewer")}</li>
            <li>{t("sections.disputes.grounds.wrongLocation")}</li>
            <li>{t("sections.disputes.grounds.technical")}</li>
            <li>{t("sections.disputes.grounds.noShow")}</li>
          </ul>
          <p className="mt-3 font-medium text-gray-900">{t("sections.disputes.resolutionsTitle")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t("sections.disputes.resolutions.reshoot") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.disputes.resolutions.partial") }} />
            <li dangerouslySetInnerHTML={{ __html: t("sections.disputes.resolutions.full") }} />
          </ul>
          <p className="mt-3 text-sm text-gray-500">{t("sections.disputes.subjectiveNote")}</p>
        </section>

        {/* 12. Force Majeure */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.forceMajeure.title")}</h2>
          <p className="mt-3">{t("sections.forceMajeure.content")}</p>
        </section>

        {/* 13. Intellectual Property */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.intellectualProperty.title")}</h2>
          <p className="mt-3">{t("sections.intellectualProperty.intro")}</p>
          <p className="mt-3 font-medium text-gray-900">{t("sections.intellectualProperty.personalUseTitle")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>{t("sections.intellectualProperty.personalUse.socialMedia")}</li>
            <li>{t("sections.intellectualProperty.personalUse.printing")}</li>
            <li>{t("sections.intellectualProperty.personalUse.wallpaper")}</li>
          </ul>
          <p className="mt-3 font-medium text-gray-900">{t("sections.intellectualProperty.notPermittedTitle")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>{t("sections.intellectualProperty.notPermitted.commercial")}</li>
            <li>{t("sections.intellectualProperty.notPermitted.stock")}</li>
            <li>{t("sections.intellectualProperty.notPermitted.ai")}</li>
            <li>{t("sections.intellectualProperty.notPermitted.editing")}</li>
          </ul>
        </section>

        {/* 14. Prohibited Content & Behaviour */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.prohibitedContent.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.prohibitedContent.items.fakeReviews")}</li>
            <li>{t("sections.prohibitedContent.items.fakePortfolio")}</li>
            <li>{t("sections.prohibitedContent.items.offensive")}</li>
            <li>{t("sections.prohibitedContent.items.spam")}</li>
            <li>{t("sections.prohibitedContent.items.offPlatform")}</li>
          </ul>
        </section>

        {/* 15. Platform Role & Liability */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.platformRole.title")}</h2>
          <p className="mt-3">{t("sections.platformRole.content")}</p>
        </section>

        {/* 16. Dispute Resolution & Governing Law */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.disputeResolution.title")}</h2>
          <p className="mt-3">{t("sections.disputeResolution.content1")}</p>
          <p className="mt-3">{t("sections.disputeResolution.content2")}</p>
        </section>

        {/* 17. Payment Chargebacks */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.chargebacks.title")}</h2>
          <p className="mt-3">{t("sections.chargebacks.content")}</p>
        </section>

        {/* 18. Contact */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.contact.title")}</h2>
          <p className="mt-3">
            {t("sections.contact.intro")}{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>{" "}
            {t("sections.contact.orThrough")}{" "}
            <Link href="/contact" className="text-primary-600 hover:underline">{t("sections.contact.contactPage")}</Link>.
          </p>
        </section>

      </div>
    </div>
  );
}
