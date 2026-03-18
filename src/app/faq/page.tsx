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
      'Browse our curated selection of professional <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographers</a> across Portugal. View their portfolios, read verified reviews, and book a photoshoot directly through our platform. Learn more on our <a href="/how-it-works" class="text-primary-600 underline hover:text-primary-700">How It Works</a> page.',
  },
  {
    question: "How much does a photoshoot cost?",
    answer:
      'Prices vary by photographer and package, typically ranging from \u20ac120 for a 30-minute quick session to \u20ac500+ for a full-day experience. Each photographer sets their own prices and packages, which you can see on their profile page. See our <a href="/pricing" class="text-primary-600 underline hover:text-primary-700">pricing page</a> for an overview.',
  },
  {
    question: "How do I book a photographer?",
    answer:
      'Find a <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographer</a> you like, choose a package, select your preferred date and time, and send a booking request. The photographer will review your request and confirm within 24 hours. See our step-by-step guide on the <a href="/how-it-works" class="text-primary-600 underline hover:text-primary-700">How It Works</a> page.',
  },
  {
    question: "Can I cancel or reschedule my booking?",
    answer:
      "Yes. You can cancel or request a reschedule through your dashboard. Free cancellation is available up to <strong>7 days</strong> before the shoot. Reschedules within 7 days are handled directly with your photographer through our messaging system \u2014 most photographers are flexible and happy to find an alternative date. If a paid booking is cancelled before photo delivery, you receive a full refund.",
  },
  {
    question: "How long until I receive my photos?",
    answer:
      'Delivery time depends on the photographer and package you choose \u2014 each package shows the estimated delivery days on the photographer\'s profile. Once ready, you\u2019ll receive a link to a <strong>private, password-protected gallery</strong> where you can view, download individually, or grab the full collection as a ZIP archive. Your gallery stays accessible for 90 days.',
  },
  {
    question: "How does the photo delivery work?",
    answer:
      "After your shoot, the photographer edits your photos and uploads them to a <strong>private, password-protected gallery</strong>. You\u2019ll receive a notification with a link and password. Once you view and accept the delivery, the photographer receives their payment. You can download photos individually in high resolution or grab the entire collection as a ZIP archive. Your gallery stays accessible for 90 days after acceptance.",
  },
  {
    question: "Are the reviews verified?",
    answer:
      "Yes. All reviews on Photo Portugal are tied to completed bookings. Only clients who have had a confirmed photoshoot can leave a review, ensuring authentic and trustworthy feedback.",
  },
  {
    question: "What locations are available?",
    answer:
      'We cover 25+ <a href="/locations" class="text-primary-600 underline hover:text-primary-700">locations</a> across Portugal, including <a href="/locations/lisbon" class="text-primary-600 underline hover:text-primary-700">Lisbon</a>, <a href="/locations/porto" class="text-primary-600 underline hover:text-primary-700">Porto</a>, <a href="/locations/algarve" class="text-primary-600 underline hover:text-primary-700">Algarve</a>, <a href="/locations/sintra" class="text-primary-600 underline hover:text-primary-700">Sintra</a>, <a href="/locations/madeira" class="text-primary-600 underline hover:text-primary-700">Madeira</a>, <a href="/locations/azores" class="text-primary-600 underline hover:text-primary-700">Azores</a>, and many more. Each location page shows available <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographers</a> and popular photoshoot spots.',
  },
  {
    question: "Do photographers speak English?",
    answer:
      'Most <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographers</a> on our platform speak English. You can filter photographers by language on the catalog page. Many also speak Portuguese, Spanish, French, and German.',
  },
  {
    question: "What if it rains on my photoshoot day?",
    answer:
      "Most photographers are flexible and will offer to reschedule for free in case of bad weather. Discuss weather contingency plans with your photographer before the shoot through our messaging system.",
  },
  {
    question: "How do I become a photographer on Photo Portugal?",
    answer:
      "Click \u2018Join as Photographer\u2019 and create your account. You can then set up your profile, upload portfolio photos, create packages, and start receiving booking requests. We offer Free, Pro, and Premium plans with different features and visibility levels.",
  },
  {
    question: "What are the photographer plans?",
    answer:
      'We offer three plans: <strong>Free</strong> (20% commission, 1 location, 10 portfolio photos), <strong>Pro</strong> at \u20ac29/month (15% commission, 5 locations, 30 portfolio photos), and <strong>Premium</strong> at \u20ac59/month (10% commission, unlimited locations, 100 portfolio photos). All plans include booking management, client messaging, verified reviews, and secure Stripe payments. Visit our <a href="/pricing" class="text-primary-600 underline hover:text-primary-700">pricing page</a> for a full comparison.',
  },
  {
    question: "Is my payment secure?",
    answer:
      "Absolutely. All payments are processed securely through <strong>Stripe</strong>, trusted by millions of businesses worldwide. You can pay with credit/debit cards, Apple Pay, or Google Pay. Your payment is held safely until your photographer delivers your photos and you accept them \u2014 so you\u2019re always protected. If a booking is cancelled before delivery, you receive a full refund.",
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
                <p className="text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: faq.answer }} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
