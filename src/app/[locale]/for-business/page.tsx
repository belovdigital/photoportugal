import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { getShootTypeBySlug, shootTypeLocalized } from "@/lib/shoot-types-data";
import { queryOne } from "@/lib/db";
import { BusinessInquiryForm } from "./BusinessInquiryForm";

export const dynamic = "force-dynamic";

// Editorial landing in the same visual language as /weddings (page-scoped
// Cormorant serif, ivory/charcoal, sharp corners, hairline rules) — the
// premium-purchase pages share this system, the bordeaux accent stays
// wedding-only; business is monochrome charcoal.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "business" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/for-business", locale),
  };
}

const USE_CASES = ["events", "conferences", "headshots", "brand", "offsites", "spaces"] as const;

export default async function ForBusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("business");

  const businessType = getShootTypeBySlug("business");
  const faqs = businessType ? shootTypeLocalized(businessType, locale).faqs : [];

  const stats = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM photographer_profiles WHERE is_approved = TRUE AND 'Business' = ANY(shoot_types)"
  );
  const photographerCount = parseInt(stats?.count || "0", 10);

  const jsonLdFaq = faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null;

  return (
    <div className="bg-[#FAF6F0] text-[#1F1B17]">
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}

      {/* ═══ 1. HERO — typographic, charcoal ═══ */}
      <section className="bg-[#1F1B17]">
        <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-24 sm:px-8 sm:pb-24 sm:pt-32">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
            Photo Portugal · {t("kicker")}
          </p>
          <h1 className={`${serif.className} mt-6 max-w-4xl text-5xl font-medium leading-[1.05] text-white sm:text-6xl lg:text-7xl`}>
            {t.rich("heroTitleRich", {
              accent: (chunks) => <em className="italic">{chunks}</em>,
            })}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">{t("heroText")}</p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href="#inquiry"
              className="inline-flex items-center gap-2 bg-white px-8 py-4 text-sm font-semibold tracking-wide text-[#1F1B17] transition hover:bg-[#FAF6F0]"
            >
              {t("heroCta")}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
            <div className="text-sm text-white/70">
              {photographerCount > 0 && <span>{t("trustPhotographers", { count: photographerCount })}</span>}
              <span aria-hidden> · </span>
              <span>{t("heroSla")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. WHAT WE SHOOT — editorial grid, hairline rules ═══ */}
      <section className="border-b border-[#1F1B17]/10">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#1F1B17]/55">
            Photo Portugal · {t("kicker")}
          </p>
          <h2 className={`${serif.className} mt-4 text-4xl font-medium sm:text-5xl`}>{t("casesTitle")}</h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {USE_CASES.map((c, i) => (
              <div key={c} className="border-t-2 border-[#1F1B17] pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#1F1B17]/45">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className={`${serif.className} mt-2 text-2xl font-medium`}>{t(`cases.${c}Title`)}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#1F1B17]/70">{t(`cases.${c}Text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. HOW IT WORKS — big serif numerals ═══ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{t("howTitle")}</h2>
          <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
            {[1, 2, 3].map((step) => (
              <div key={step}>
                <span className={`${serif.className} block text-6xl font-medium leading-none text-[#1F1B17]/25`} aria-hidden>
                  {String(step).padStart(2, "0")}
                </span>
                <h3 className={`${serif.className} mt-4 text-2xl font-medium`}>{t(`how${step}Title`)}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#1F1B17]/70">{t(`how${step}Text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. WHY US — quiet editorial list ═══ */}
      <section className="border-t border-[#1F1B17]/10">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{t("whyTitle")}</h2>
          <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
            {["single", "vetted", "manager", "speed"].map((w) => (
              <div key={w} className="flex gap-4">
                <span className="mt-[14px] h-px w-6 shrink-0 bg-[#1F1B17]/60" aria-hidden />
                <div>
                  <h3 className={`${serif.className} text-xl font-medium sm:text-2xl`}>{t(`why.${w}Title`)}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#1F1B17]/70">{t(`why.${w}Text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. INQUIRY FORM ═══ */}
      <section id="inquiry" className="scroll-mt-20 border-t border-[#1F1B17]/10 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#1F1B17]/55">
            Photo Portugal · {t("kicker")}
          </p>
          <h2 className={`${serif.className} mt-4 text-4xl font-medium sm:text-5xl`}>{t("formTitle")}</h2>
          <p className="mt-4 max-w-xl text-[#1F1B17]/65">{t("formSubtitle")}</p>
          <div className="mt-10">
            <Suspense>
              <BusinessInquiryForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ═══ 6. FAQ — editorial accordion ═══ */}
      {faqs.length > 0 && (
        <section className="border-t border-[#1F1B17]/10">
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className={`${serif.className} text-4xl font-medium sm:text-5xl`}>{t("faqTitle")}</h2>
            <div className="mt-10">
              {faqs.map((faq, i) => (
                <details key={i} className="group border-b border-[#1F1B17]/15">
                  <summary className={`${serif.className} flex cursor-pointer items-baseline justify-between gap-6 py-6 text-xl font-medium sm:text-2xl`}>
                    {faq.question}
                    <svg className="h-5 w-5 shrink-0 translate-y-1 text-[#1F1B17] transition group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </summary>
                  <p className="pb-7 pr-10 text-[15px] leading-relaxed text-[#1F1B17]/70">{faq.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-10 text-sm text-[#1F1B17]/50">
              {t("faqFootnote")}{" "}
              <a href="mailto:info@photoportugal.com" className="underline underline-offset-2 hover:text-[#1F1B17]">
                info@photoportugal.com
              </a>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
