import { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "pt"
      ? "Como Selecionamos os Nossos Fotógrafos"
      : "How We Select Our Photographers",
    description: locale === "pt"
      ? "Cada fotógrafo na Photo Portugal é pessoalmente avaliado pela nossa equipa fundadora. Conheça o nosso processo de seleção rigoroso."
      : "Every photographer on Photo Portugal is personally vetted by our founding team. Learn about our rigorous selection process.",
    alternates: localeAlternates("/how-we-select", locale),
  };
}

export default async function HowWeSelectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  const steps = [
    {
      title: "Portfolio Review",
      description: "We start by reviewing each photographer's complete body of work — not just the highlights. We look for consistency in quality, natural lighting skills, genuine emotion in portraits, and the ability to capture Portugal's unique character.",
      icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      title: "Social Media & Reputation Check",
      description: "We examine each photographer's presence across platforms — Instagram, Google reviews, wedding directories, and local photography communities. We look for authentic engagement, real client interactions, and a professional online presence.",
      icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    },
    {
      title: "Personal Conversation",
      description: "Every photographer goes through a personal conversation with our team. We discuss their experience, their approach to making clients comfortable, how they handle challenging conditions, and their commitment to delivering exceptional results.",
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    },
    {
      title: "Test Session & Onboarding",
      description: "Approved photographers complete a thorough onboarding process including profile setup, portfolio curation, and package creation. We guide them through our quality standards and client communication best practices.",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "Ongoing Quality Monitoring",
      description: "Selection doesn't end at approval. We continuously monitor client reviews, delivery quality, response times, and overall satisfaction. Photographers who consistently exceed expectations earn Verified and Featured badges.",
      icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "How We Select Our Photographers",
    description: "Learn about Photo Portugal's rigorous photographer vetting process.",
    url: "https://photoportugal.com/how-we-select",
    publisher: {
      "@type": "Organization",
      name: "Photo Portugal",
      url: "https://photoportugal.com",
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="font-display text-4xl font-bold text-gray-900 text-center">
        How We Select Our Photographers
      </h1>
      <p className="mt-4 text-center text-lg text-gray-500">
        Not every photographer makes the cut. We personally vet every single photographer on our platform to ensure you get an exceptional experience.
      </p>

      <div className="mt-12 space-y-8">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
              <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                <span className="mr-2 text-primary-600">Step {i + 1}.</span>
                {step.title}
              </h2>
              <p className="mt-1.5 text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-2xl bg-warm-50 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-gray-900">
          Founded by a photographer, for photographers
        </h2>
        <p className="mt-3 text-gray-600 leading-relaxed max-w-xl mx-auto">
          Photo Portugal was founded by Kate Belova, a professional photographer with over 10 years of experience. Kate knows firsthand what makes a great photoshoot — the technical skill, the ability to connect with people, and the instinct for finding the perfect light. That&apos;s why she personally oversees the photographer selection process.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/photographers" className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">
            Browse Photographers
          </Link>
          <Link href="/about" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            About Photo Portugal
          </Link>
        </div>
      </div>
    </div>
  );
}
