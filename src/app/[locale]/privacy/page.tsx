import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tc = await getTranslations("common");
  const tp = await getTranslations("privacy");
  return {
    title: tc("privacyPolicy"),
    description: tp("metaDescription"),
    alternates: localeAlternates("/privacy", locale),
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="font-display text-4xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-4 text-sm text-gray-400">{t("lastUpdated")}</p>

      <div className="mt-8 space-y-8 text-gray-600 leading-relaxed">
        {/* 1. Information We Collect */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.informationWeCollect.title")}</h2>
          <p className="mt-3">{t("sections.informationWeCollect.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.account") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.photographer") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.booking") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.messages") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.payment") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.usage") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationWeCollect.items.cookies") }} />
          </ul>
        </section>

        {/* 2. Legal Basis for Processing */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.legalBasis.title")}</h2>
          <p className="mt-3">{t("sections.legalBasis.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.legalBasis.items.contract") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.legalBasis.items.consent") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.legalBasis.items.legitimateInterest") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.legalBasis.items.legalObligation") }} />
          </ul>
        </section>

        {/* 3. How We Use Your Information */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.howWeUse.title")}</h2>
          <ul className="mt-3 list-disc pl-6 space-y-1">
            <li>{t("sections.howWeUse.items.provide")}</li>
            <li>{t("sections.howWeUse.items.facilitate")}</li>
            <li>{t("sections.howWeUse.items.display")}</li>
            <li>{t("sections.howWeUse.items.payments")}</li>
            <li>{t("sections.howWeUse.items.notifications")}</li>
            <li>{t("sections.howWeUse.items.marketing")}</li>
            <li>{t("sections.howWeUse.items.fraud")}</li>
            <li>{t("sections.howWeUse.items.analytics")}</li>
            <li>{t("sections.howWeUse.items.legal")}</li>
          </ul>
        </section>

        {/* 4. Information Sharing & Third-Party Services */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.informationSharing.title")}</h2>
          <p className="mt-3">{t("sections.informationSharing.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.items.bookingParties") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.items.serviceProviders") }} />
          </ul>
          <ul className="mt-2 list-disc pl-10 space-y-1">
            <li><span dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.processors.stripe") }} />{" "}<a href="https://stripe.com/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
            <li><span dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.processors.google") }} />{" "}<a href="https://policies.google.com/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
            <li><span dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.processors.digitalocean") }} />{" "}<a href="https://www.digitalocean.com/legal/privacy-policy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">DigitalOcean Privacy Policy</a></li>
            <li><span dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.processors.twilio") }} />{" "}<a href="https://www.twilio.com/legal/privacy" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a></li>
          </ul>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.informationSharing.legalRequirements") }} />
          </ul>
        </section>

        {/* 5. Data Processing Agreements */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.dataProcessing.title")}</h2>
          <p className="mt-3">{t("sections.dataProcessing.content")}</p>
        </section>

        {/* 6. International Data Transfers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.internationalTransfers.title")}</h2>
          <p className="mt-3">{t("sections.internationalTransfers.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.internationalTransfers.items.stripe") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.internationalTransfers.items.google") }} />
          </ul>
          <p className="mt-2">
            {t("sections.internationalTransfers.safeguards")}{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.
          </p>
        </section>

        {/* 7. Data Retention */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.dataRetention.title")}</h2>
          <p className="mt-3">{t("sections.dataRetention.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.dataRetention.items.account") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.dataRetention.items.booking") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.dataRetention.items.messages") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.dataRetention.items.analytics") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.dataRetention.items.marketing") }} />
          </ul>
          <p className="mt-2">{t("sections.dataRetention.deletion")}</p>
        </section>

        {/* 8. Cookies */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.cookies.title")}</h2>
          <p className="mt-3">{t("sections.cookies.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.cookies.items.essential") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.cookies.items.analytics") }} />
          </ul>
          <p className="mt-2">{t("sections.cookies.noTracking")}</p>
        </section>

        {/* 9. Data Security */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.dataSecurity.title")}</h2>
          <p className="mt-3">{t("sections.dataSecurity.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>{t("sections.dataSecurity.items.https")}</li>
            <li>{t("sections.dataSecurity.items.hashing")}</li>
            <li>{t("sections.dataSecurity.items.rbac")}</li>
            <li>{t("sections.dataSecurity.items.reviews")}</li>
            <li>{t("sections.dataSecurity.items.backups")}</li>
          </ul>
          <p className="mt-2">{t("sections.dataSecurity.disclaimer")}</p>
        </section>

        {/* 10. Your Rights Under the GDPR */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.yourRights.title")}</h2>
          <p className="mt-3">{t("sections.yourRights.intro")}</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.access") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.rectification") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.erasure") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.restriction") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.portability") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.object") }} />
            <li dangerouslySetInnerHTML={{ __html: t.raw("sections.yourRights.items.withdrawConsent") }} />
          </ul>
          <p className="mt-2">
            {t("sections.yourRights.exercise")}{" "}
            <a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>.{" "}
            {t("sections.yourRights.responseTime")}
          </p>
        </section>

        {/* 11. Right to Lodge a Complaint */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.complaint.title")}</h2>
          <p className="mt-3">{t("sections.complaint.intro")}</p>
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm">
            <p className="font-semibold text-gray-900">{t("sections.complaint.cnpdName")}</p>
            <p className="mt-1">{t("sections.complaint.cnpdAddress1")}</p>
            <p>{t("sections.complaint.cnpdAddress2")}</p>
            <p className="mt-1">{t("sections.complaint.cnpdWebsite")}{" "}<a href="https://www.cnpd.pt" className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">www.cnpd.pt</a></p>
          </div>
          <p className="mt-3">{t("sections.complaint.otherAuthority")}</p>
        </section>

        {/* 12. Children's Privacy */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.children.title")}</h2>
          <p className="mt-3">{t("sections.children.content")}{" "}<a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a>{t("sections.children.contentAfterEmail")}</p>
        </section>

        {/* 13. Business Transfers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.businessTransfers.title")}</h2>
          <p className="mt-3">{t("sections.businessTransfers.content")}</p>
        </section>

        {/* 14. Changes to This Policy */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.changes.title")}</h2>
          <p className="mt-3">{t("sections.changes.content")}</p>
        </section>

        {/* 15. Contact */}
        <section>
          <h2 className="text-xl font-bold text-gray-900">{t("sections.contact.title")}</h2>
          <p className="mt-3">{t("sections.contact.intro")}</p>
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm">
            <p className="font-semibold text-gray-900">Photo Portugal</p>
            <p className="mt-1">Email:{" "}<a href="mailto:info@photoportugal.com" className="text-primary-600 hover:underline">info@photoportugal.com</a></p>
            <p>Website: <a href="https://photoportugal.com" className="text-primary-600 hover:underline">photoportugal.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
