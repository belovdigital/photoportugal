import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shootTypes } from "@/lib/shoot-types-data";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";
import { query, queryOne } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shootTypesPage");
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates("/photoshoots", locale),
  };
}

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

async function getShootTypeStats(): Promise<Record<string, { count: number; minPrice: number | null }>> {
  // For each shoot type slug we resolve aliases, then query counts + min price per alias set.
  const result: Record<string, { count: number; minPrice: number | null }> = {};
  await Promise.all(
    shootTypes.map(async (st) => {
      const aliases = st.photographerShootTypeNames || [st.name];
      try {
        const row = await queryOne<{ count: string; min_price: string | null }>(
          `SELECT COUNT(DISTINCT pp.id)::text as count,
                  (SELECT MIN(pk.price) FROM packages pk
                   JOIN photographer_profiles pp2 ON pp2.id = pk.photographer_id
                   WHERE pp2.is_approved = TRUE AND pk.is_public = TRUE
                     AND pp2.shoot_types && $1::text[]) as min_price
           FROM photographer_profiles pp
           WHERE pp.is_approved = TRUE AND pp.shoot_types && $1::text[]`,
          [aliases]
        );
        result[st.slug] = {
          count: parseInt(row?.count || "0"),
          minPrice: row?.min_price ? parseFloat(row.min_price) : null,
        };
      } catch {
        result[st.slug] = { count: 0, minPrice: null };
      }
    })
  );
  return result;
}

export default async function PhotoshootsHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("shootTypesPage");
  const tc = await getTranslations("common");

  const [stats, totalPhotogs] = await Promise.all([
    getShootTypeStats(),
    queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM photographer_profiles WHERE is_approved = TRUE`
    ).then((r) => parseInt(r?.count || "0")).catch(() => 0),
  ]);

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
          { name: tc("home"), href: "/" },
          { name: tc("photoshoots"), href: "/photoshoots" },
        ]}
      />

      {/* Hero */}
      <section className="border-b border-warm-200 bg-gradient-to-b from-warm-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-bold text-gray-900 sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg text-gray-500">
              {t("subtitle")}
            </p>

            {/* Stat row */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-accent-500" />
                <span className="font-semibold text-gray-900">{totalPhotogs}+</span>
                <span className="text-gray-500">{locale === "pt" ? "fotógrafos verificados" : "verified photographers"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-amber-400" />
                <span className="font-semibold text-gray-900">{shootTypes.length}</span>
                <span className="text-gray-500">{locale === "pt" ? "tipos de sessão" : "photoshoot types"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-primary-500" />
                <span className="font-semibold text-gray-900">32</span>
                <span className="text-gray-500">{locale === "pt" ? "locais" : "locations across Portugal"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shootTypes.map((type) => {
            const s = stats[type.slug] || { count: 0, minPrice: null };
            return (
              <Link
                key={type.slug}
                href={`/photoshoots/${type.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg"
              >
                {/* Icon + count */}
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-amber-50 text-primary-600 ring-1 ring-primary-100">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={shootTypeIcons[type.slug] || shootTypeIcons.couples} />
                    </svg>
                  </div>
                  {s.count > 0 && (
                    <span className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700">
                      {s.count} {locale === "pt" ? (s.count === 1 ? "fotógrafo" : "fotógrafos") : (s.count === 1 ? "photographer" : "photographers")}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="mt-4 font-display text-xl font-bold text-gray-900 transition group-hover:text-primary-600">
                  {type.name}
                </h2>

                {/* Short description */}
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500 line-clamp-3">
                  {type.heroText.slice(0, 150)}...
                </p>

                {/* Footer: price + CTA */}
                <div className="mt-5 flex items-end justify-between border-t border-warm-100 pt-4">
                  <div>
                    {s.minPrice !== null ? (
                      <>
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">{locale === "pt" ? "A partir de" : "From"}</p>
                        <p className="font-bold text-gray-900">€{Math.round(s.minPrice)}</p>
                      </>
                    ) : (
                      <p className="text-[11px] uppercase tracking-wider text-gray-400">{locale === "pt" ? "Em breve" : "Coming soon"}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition group-hover:bg-primary-100">
                    {locale === "pt" ? "Ver" : "View"}
                    <svg className="h-3 w-3 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works strip */}
      <section className="border-y border-warm-200 bg-warm-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { step: "01", title: locale === "pt" ? "Escolha" : "Choose", desc: locale === "pt" ? "Tipo de sessão + local" : "Pick shoot type + location" },
              { step: "02", title: locale === "pt" ? "Reserve" : "Book", desc: locale === "pt" ? "Pagamento seguro — retido até à entrega" : "Secure payment held until delivery" },
              { step: "03", title: locale === "pt" ? "Receba" : "Receive", desc: locale === "pt" ? "Fotos editadas em alta resolução" : "Edited high-res photos, delivered" },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <span className="font-display text-2xl font-bold text-primary-300">{s.step}</span>
                <div>
                  <p className="font-semibold text-gray-900">{s.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="overflow-hidden rounded-2xl bg-gray-900 px-8 py-12 text-center sm:px-12">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/photographers"
              className="inline-flex rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-700"
            >
              {t("browseAllPhotographers")}
            </Link>
            <Link
              href="/find-photographer"
              className="inline-flex rounded-xl border border-gray-700 bg-gray-800 px-8 py-4 text-base font-semibold text-white transition hover:bg-gray-700"
            >
              {locale === "pt" ? "Ajuda-me a escolher" : "Help me choose"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
