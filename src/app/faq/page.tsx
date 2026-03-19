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
      'Prices vary by photographer and package, typically ranging from €120 for a 30-minute quick session to €500+ for a full-day experience. Each photographer sets their own prices and packages, which you can see on their profile page. See our <a href="/pricing" class="text-primary-600 underline hover:text-primary-700">pricing page</a> for an overview.',
  },
  {
    question: "How do I book a photographer?",
    answer:
      'Find a <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographer</a> you like, choose a package, select your preferred date and time, and send a booking request. The photographer will review your request and confirm within 24 hours. Your payment is collected at booking and held securely until your photos are delivered.',
  },
  {
    question: "How does payment work? Is it secure?",
    answer:
      'All payments are processed securely through <strong>Stripe</strong>, trusted by millions of businesses worldwide. Your payment is held in escrow — we don\'t release it to the photographer until you receive and accept your photos. This means you\'re always protected. You can pay with credit/debit cards, Apple Pay, or Google Pay.',
  },
  {
    question: "Can I cancel my booking?",
    answer:
      'Yes, you can cancel through your dashboard. Cancellation <strong>7+ days</strong> before the shoot gives you a full refund. Between 3–7 days: 50% refund. Less than 3 days: no refund (the photographer reserved their time for you). See our <a href="/terms" class="text-primary-600 underline hover:text-primary-700">Terms of Service</a> for full details.',
  },
  {
    question: "Can I reschedule my booking?",
    answer:
      "Yes. One free reschedule is included if you request it <strong>48+ hours</strong> before the shoot. Rescheduling due to bad weather is always free for both parties. For changes within 48 hours, contact your photographer directly — most are flexible and happy to find an alternative time.",
  },
  {
    question: "What happens if the photographer cancels?",
    answer:
      "You receive a <strong>100% refund</strong>, always. If the cancellation is last-minute (less than 48 hours), we'll also try to find a replacement photographer for you. Photographers who cancel repeatedly may be removed from the platform.",
  },
  {
    question: "How long until I receive my photos?",
    answer:
      'Delivery time depends on the package you choose — each package shows the estimated delivery days on the photographer\'s profile (typically 3–14 days). Once ready, you\'ll receive a link to a <strong>private, password-protected gallery</strong> where you can view, download individually, or grab the full collection as a ZIP archive.',
  },
  {
    question: "What if I'm not happy with the photos?",
    answer:
      'You have <strong>7 days</strong> after delivery to accept your photos or open a dispute. Valid reasons for a dispute include: significantly fewer photos than promised, wrong location, severe technical issues, or photographer no-show. We\'ll work with both parties to find a fair resolution — reshoot, partial refund, or full refund. Note that subjective style preferences are not grounds for a refund, so review portfolios carefully before booking. See our <a href="/terms" class="text-primary-600 underline hover:text-primary-700">Terms of Service</a> for details.',
  },
  {
    question: "How long can I access my photo gallery?",
    answer:
      "Your private gallery stays accessible for <strong>90 days</strong> after delivery. We recommend downloading all your photos within this period. You can download them individually or as a complete ZIP archive.",
  },
  {
    question: "What if it rains on my photoshoot day?",
    answer:
      "Weather rescheduling is always <strong>free</strong> for both parties — no penalties, no fees. Either you or the photographer can request a reschedule due to weather conditions unsuitable for outdoor photography. Discuss a backup plan with your photographer when you book.",
  },
  {
    question: "Are the reviews verified?",
    answer:
      "Yes. All reviews on Photo Portugal are tied to completed bookings. Only clients who have had a confirmed photoshoot can leave a review, ensuring authentic and trustworthy feedback.",
  },
  {
    question: "What locations are available?",
    answer:
      'We cover 25+ <a href="/locations" class="text-primary-600 underline hover:text-primary-700">locations</a> across Portugal, including <a href="/locations/lisbon" class="text-primary-600 underline hover:text-primary-700">Lisbon</a>, <a href="/locations/porto" class="text-primary-600 underline hover:text-primary-700">Porto</a>, <a href="/locations/algarve" class="text-primary-600 underline hover:text-primary-700">Algarve</a>, <a href="/locations/sintra" class="text-primary-600 underline hover:text-primary-700">Sintra</a>, <a href="/locations/madeira" class="text-primary-600 underline hover:text-primary-700">Madeira</a>, <a href="/locations/azores" class="text-primary-600 underline hover:text-primary-700">Azores</a>, and many more.',
  },
  {
    question: "Do photographers speak English?",
    answer:
      'Most <a href="/photographers" class="text-primary-600 underline hover:text-primary-700">photographers</a> on our platform speak English. You can filter photographers by language on the catalog page. Many also speak Portuguese, Spanish, French, and German.',
  },
  {
    question: "How do I become a photographer on Photo Portugal?",
    answer:
      "Click 'Join as Photographer' and create your account. Set up your profile, upload portfolio photos, create packages, and start receiving booking requests. We offer Free, Pro, and Premium plans with different features and commission rates.",
  },
  {
    question: "What are the photographer plans?",
    answer:
      'We offer three plans: <strong>Free</strong> (20% commission, 1 location, 10 portfolio photos), <strong>Pro</strong> at €29/month (15% commission, 5 locations, 30 portfolio photos), and <strong>Premium</strong> at €59/month (10% commission, unlimited locations and portfolio photos). Visit our <a href="/pricing" class="text-primary-600 underline hover:text-primary-700">pricing page</a> for a full comparison.',
  },
  {
    question: "What is the Early Bird program?",
    answer:
      'We\'re offering exclusive benefits to our first photographers. The <strong>first 10 photographers</strong> (Founding tier) get the Premium plan free forever with an exclusive "Founding Photographer" badge. The <strong>next 50</strong> get Premium free for 6 months, and the <strong>next 100</strong> get Pro free for 3 months. Spots are limited and first-come-first-served. <a href="/join" class="text-primary-600 underline hover:text-primary-700">Check available spots</a>.',
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
            Vacation Photoshoot in Portugal — Pricing, Booking, Delivery &amp; More
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
