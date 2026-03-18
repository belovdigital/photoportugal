import type { Metadata } from "next";
import Link from "next/link";
import { shootTypes } from "@/lib/shoot-types-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";

export const metadata: Metadata = {
  title: "Photoshoot Types in Portugal — Couples, Family, Proposal & More",
  description:
    "Explore all vacation photoshoot types available in Portugal. Couples, family, proposal, engagement, honeymoon, solo, elopement & friends trip photography.",
  alternates: { canonical: "https://photoportugal.com/photoshoots" },
};

const shootTypeIcons: Record<string, string> = {
  couples: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  family: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  proposal: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  engagement: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
  honeymoon: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
  solo: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  elopement: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
  friends: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
};

export default function PhotoshootsHubPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: shootTypes.length,
    itemListElement: shootTypes.map((type, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://photoportugal.com/photoshoots/${type.slug}`,
      name: `${type.name} Photoshoot in Portugal`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Photoshoots", href: "/photoshoots" },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
            Vacation Photoshoot Types in Portugal
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Whatever brings you to Portugal, we have the perfect photographer for your occasion.
            From romantic couples sessions to fun friends trip photos, explore all the ways to
            capture your Portugal experience.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shootTypes.map((type) => (
            <Link
              key={type.slug}
              href={`/photoshoots/${type.slug}`}
              className="group rounded-2xl border border-warm-200 bg-white p-6 transition hover:border-primary-200 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition group-hover:bg-primary-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={shootTypeIcons[type.slug] || shootTypeIcons.couples} />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-primary-600 transition">
                {type.name} Photoshoot
              </h2>
              <p className="mt-2 text-sm text-gray-500 line-clamp-3">
                {type.heroText.slice(0, 150)}...
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                Learn more
                <svg className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gray-900 px-8 py-12 text-center sm:px-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Not sure which type to choose?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            Browse our photographers and filter by occasion. Many photographers offer
            multiple shoot types and can customize the session to your needs.
          </p>
          <Link
            href="/photographers"
            className="mt-8 inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-700"
          >
            Browse All Photographers
          </Link>
        </div>
      </div>
    </>
  );
}
