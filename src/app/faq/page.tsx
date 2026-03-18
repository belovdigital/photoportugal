import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Vacation Photoshoot Portugal FAQ — Pricing, Booking & More",
  description:
    "Find answers to common questions about booking a vacation photographer in Portugal. Pricing, cancellation policy, delivery times, locations, and more.",
  alternates: { canonical: "https://photoportugal.com/faq" },
};

const faqs = [
  {
    question: "How does Photo Portugal work?",
    answer:
      "Browse our curated selection of professional photographers across Portugal. View their portfolios, read verified reviews, and book a photoshoot directly through our platform. After booking, you can message your photographer to discuss details.",
  },
  {
    question: "How much does a photoshoot cost?",
    answer:
      "Prices vary by photographer and package, typically ranging from €120 for a 30-minute quick session to €500+ for a full-day experience. Each photographer sets their own prices and packages, which you can see on their profile page.",
  },
  {
    question: "How do I book a photographer?",
    answer:
      "Find a photographer you like, choose a package, select your preferred date and time, and send a booking request. The photographer will review your request and confirm within 24 hours. You can also include a message with any special requests.",
  },
  {
    question: "Can I cancel or reschedule my booking?",
    answer:
      "Yes. You can cancel or request a reschedule through your dashboard. Cancellation policies vary by photographer — most offer free cancellation up to 48 hours before the shoot. Contact your photographer directly through our messaging system for reschedule requests.",
  },
  {
    question: "How long until I receive my photos?",
    answer:
      "Delivery time varies by photographer, but most deliver edited photos within 3-7 business days after your session. Some offer rush delivery for an additional fee. Check the photographer's profile for their specific turnaround time.",
  },
  {
    question: "Are the reviews verified?",
    answer:
      "Yes. All reviews on Photo Portugal are tied to completed bookings. Only clients who have had a confirmed photoshoot can leave a review, ensuring authentic and trustworthy feedback.",
  },
  {
    question: "What locations are available?",
    answer:
      "We cover 23+ locations across Portugal, including Lisbon, Porto, Algarve, Sintra, Madeira, Azores, Douro Valley, Cascais, Lagos, Nazaré, Évora, and many more. Each location page shows available photographers and popular photoshoot spots.",
  },
  {
    question: "Do photographers speak English?",
    answer:
      "Most photographers on our platform speak English. You can filter photographers by language on the catalog page. Many also speak Portuguese, Spanish, French, and German.",
  },
  {
    question: "What if it rains on my photoshoot day?",
    answer:
      "Most photographers are flexible and will offer to reschedule for free in case of bad weather. Discuss weather contingency plans with your photographer before the shoot through our messaging system.",
  },
  {
    question: "How do I become a photographer on Photo Portugal?",
    answer:
      "Click 'Join as Photographer' and create your account. You can then set up your profile, upload portfolio photos, create packages, and start receiving booking requests. We offer Free, Pro, and Premium plans with different features and visibility levels.",
  },
  {
    question: "What are the photographer plans?",
    answer:
      "We offer three plans — Free, Pro, and Premium — each with different portfolio limits, location slots, and visibility features. Visit our pricing page for current rates and a full feature comparison.",
  },
  {
    question: "Is my payment secure?",
    answer:
      "Payment details are arranged directly between you and the photographer after booking confirmation. We're working on integrating secure escrow payments through Stripe Connect, which will hold funds until the session is completed.",
  },
];

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "FAQ", href: "/faq" },
        ]}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gray-900">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Vacation Photoshoot in Portugal — Pricing, Booking, Delivery & More
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-warm-200 bg-white"
            >
              <summary className="flex items-center justify-between px-6 py-5 font-semibold text-gray-900">
                {faq.question}
                <svg
                  className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5">
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
