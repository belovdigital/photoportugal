import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { GiftCardCheckoutForm } from "./GiftCardCheckoutForm";
import { GIFT_CARD_TIERS } from "@/lib/gift-card";
import { localeAlternates, openGraphIdentity } from "@/lib/seo";
import { getSiteReviewStats } from "@/lib/reviews-data";
import { country } from "@/lib/country";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  // The brand is dropped from the title itself: the root template appends
  // "| Photo Spain", so naming it here printed it twice and pushed the whole
  // thing past what a result shows.
  const title = locale === "pt" ? "Ofereça uma sessão fotográfica — cartões-presente"
    : locale === "de" ? "Fotoshooting verschenken — Geschenkkarten"
    : locale === "es" ? "Regale una sesión de fotos — tarjetas regalo"
    : locale === "fr" ? "Offrez une séance photo — cartes cadeaux"
    : "Gift a photoshoot — gift cards";
  const cn = country.countryName[locale as keyof typeof country.countryName] ?? country.areaServed;
  const description = locale === "pt" ? `Ofereça uma sessão fotográfica de 1 ou 2 horas em ${cn}. O destinatário escolhe o fotógrafo; você prepara a surpresa.`
    : locale === "de" ? `Verschenken Sie eine 1- oder 2-stündige Fotoshooting-Session in ${cn}. Die Empfänger:in wählt den Fotografen; Sie sorgen für die Überraschung.`
    : locale === "es" ? `Regale una sesión fotográfica de 1 o 2 horas en ${cn}. La persona elige al fotógrafo; usted prepara la sorpresa.`
    : locale === "fr" ? `Offrez une séance photo d'1 ou 2 heures ${country.countryIn.fr}. Le destinataire choisit le photographe ; vous préparez la surprise.`
    : `Gift a 1-hour or 2-hour photo session in ${cn}. Recipient picks the photographer; you handle the surprise.`;
  return {
    title,
    description,
    alternates: localeAlternates("/gift-cards", locale),
    openGraph: {
      ...openGraphIdentity("/gift-cards", locale),
      title,
      description,
      images: [{ url: country.ogImage, width: 1200, height: 630, alt: `${country.brand}` }],
    },
  };
}

export default async function GiftCardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("giftCardsPage");

  const tiers = [GIFT_CARD_TIERS.express, GIFT_CARD_TIERS.full];
  const reviewStats = await getSiteReviewStats().catch(() => ({ avgRating: 5.0, count: 0 }));
  const base = country.baseUrl;
  const pageUrl = `${base}${locale === "en" ? "" : "/" + locale}/gift-cards`;

  // JSON-LD: Product with two Offers (one per tier) + AggregateRating
  // pulled from real site reviews. AggregateOffer rolls up the price
  // range so Google can show the card as a single SERP result.
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${country.brand} Gift Card`,
    description: `Photoshoot gift card valid for any participating ${country.brand} photographer in ${country.areaServed}. Valid 12 months from purchase.`,
    image: `${base}${country.ogImage}`,
    brand: { "@type": "Brand", name: `${country.brand}` },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: tiers[0].buyerPrice,
      highPrice: tiers[tiers.length - 1].buyerPrice,
      offerCount: tiers.length,
      availability: "https://schema.org/InStock",
      // Google's Merchant-listings parser wants these on every offer it
      // sees as a "product". Gift cards are digital — instant delivery
      // by email, no shipping, refundable within 14 days (EU consumer law).
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: country.code.toUpperCase(),
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "EUR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: country.code.toUpperCase() },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
        },
      },
      offers: tiers.map((tier) => ({
        "@type": "Offer",
        name: `${tier.label} gift card`,
        description: `${tier.durationMinutes >= 60 ? `${tier.durationMinutes / 60}-hour` : `${tier.durationMinutes}-min`} photoshoot · ${tier.photos} edited photos · ${tier.locations} location${tier.locations > 1 ? "s" : ""}.`,
        price: tier.buyerPrice,
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: pageUrl,
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: country.code.toUpperCase(),
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 14,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        },
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "EUR" },
          shippingDestination: { "@type": "DefinedRegion", addressCountry: country.code.toUpperCase() },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
            transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
          },
        },
      })),
    },
  };

  if (reviewStats.count > 0) {
    productSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviewStats.avgRating.toFixed(1),
      reviewCount: reviewStats.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // BreadcrumbList: tells Google the path Home › Gift cards so the
  // SERP shows breadcrumbs instead of a raw URL.
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${base}${locale === "en" ? "/" : "/" + locale + "/"}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Gift cards",
        item: pageUrl,
      },
    ],
  };

  // FAQ schema mirrors the "How it works" section so Google can surface
  // it as a rich result on the SERP.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How long is a ${country.brand} gift card valid?`,
        acceptedAnswer: { "@type": "Answer", text: "12 months from the date of purchase. After that the gift expires and cannot be redeemed." },
      },
      {
        "@type": "Question",
        name: "Can the recipient pick any photographer?",
        acceptedAnswer: { "@type": "Answer", text: `Yes — the gift card works with any participating ${country.brand} photographer across ${country.areaServed}. The recipient browses the catalog and picks the one whose style they love.` },
      },
      {
        "@type": "Question",
        name: "What happens if the photographer cancels?",
        acceptedAnswer: { "@type": "Answer", text: "If a photographer has to cancel after the recipient books, the gift card is automatically restored with 30 extra days added to the expiry." },
      },
      {
        "@type": "Question",
        name: "What payment methods are accepted?",
        acceptedAnswer: { "@type": "Answer", text: "Card, Apple Pay, and Google Pay — all processed securely by Stripe." },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-warm-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <p className="text-3xl mb-2">🎁</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t("h1")}
          </h1>
          <p className="mt-3 text-base text-gray-600 max-w-xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Tier picker + form — merged. The selector below IS the only
            place tiers are shown; no duplicate "info card" block above. */}
        <div className="mt-10">
          <GiftCardCheckoutForm />
        </div>

        <section className="mt-10 rounded-xl border border-warm-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900 mb-2">{t("howItWorks")}</h2>
          <ol className="space-y-2 text-sm text-gray-700">
            <li><span className="font-medium text-gray-900">1.</span> {t("step1")}</li>
            <li><span className="font-medium text-gray-900">2.</span> {t("step2")}</li>
            <li><span className="font-medium text-gray-900">3.</span> {t("step3")}</li>
            <li><span className="font-medium text-gray-900">4.</span> {t("step4")}</li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            {t("fineprint")}
          </p>
        </section>
      </div>
    </main>
  );
}
