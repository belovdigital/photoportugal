import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { locations, getLocationBySlug } from "@/lib/locations-data";
import { shootTypes, getShootTypeBySlug } from "@/lib/shoot-types-data";
import { query, queryOne } from "@/lib/db";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { ScarcityBanner } from "@/components/ui/ScarcityBanner";
import { ActiveBadge } from "@/components/ui/ActiveBadge";
import { normalizeName } from "@/lib/format-name";
import { locationImage } from "@/lib/unsplash-images";

export const revalidate = 300; // 5 min ISR — fresh photographer data

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ locale: string; city: string }>;
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const { type } = await searchParams;
  const loc = getLocationBySlug(city);
  const st = type ? getShootTypeBySlug(type) : null;
  const locName = loc?.name || city;
  const label = st ? `${st.name} Photographers in ${locName}` : `Photographers in ${locName}`;
  return {
    title: `${label} — Book Instantly | Photo Portugal`,
    description: `Professional ${st?.name.toLowerCase() || "photoshoot"} photographers in ${locName}. Hand-picked, verified, instant booking. Secure payment, money-back guarantee.`,
    robots: { index: false, follow: false }, // paid-ad LP — don't index
  };
}

interface LPPhotographer {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_founding: boolean;
  last_seen_at: string | null;
  packages: { id: string; name: string; price: number; duration_minutes: number; num_photos: number }[];
}

export default async function LandingPage({ params, searchParams }: {
  params: Promise<{ locale: string; city: string }>;
  searchParams: Promise<{ type?: string; utm_source?: string; utm_campaign?: string; utm_term?: string; gclid?: string }>;
}) {
  const { locale, city } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const loc = getLocationBySlug(city);
  if (!loc) notFound();

  const st = sp.type ? getShootTypeBySlug(sp.type) : null;
  const shootTypeAliases = st?.photographerShootTypeNames || (st ? [st.name] : null);

  // Fetch 6 photographers matching city + (optional) shoot type
  const rows = shootTypeAliases
    ? await query<LPPhotographer & { min_price: string | null }>(
        `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.tagline,
                pp.rating, pp.review_count, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
                u.last_seen_at,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', pk.id, 'name', pk.name, 'price', pk.price,
                                                     'duration_minutes', pk.duration_minutes, 'num_photos', pk.num_photos)
                                   ORDER BY pk.price ASC)
                   FROM packages pk WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE),
                  '[]'::json
                ) as packages
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         JOIN photographer_locations pl ON pl.photographer_id = pp.id
         WHERE pp.is_approved = TRUE
           AND pl.location_slug = $1
           AND pp.shoot_types && $2::text[]
         ORDER BY pp.is_featured DESC, pp.rating DESC NULLS LAST, pp.review_count DESC, RANDOM()
         LIMIT 6`,
        [city, shootTypeAliases]
      ).catch(() => [])
    : await query<LPPhotographer & { min_price: string | null }>(
        `SELECT pp.id, pp.slug, u.name, u.avatar_url, pp.cover_url, pp.tagline,
                pp.rating, pp.review_count, pp.is_verified, COALESCE(pp.is_founding, FALSE) as is_founding,
                u.last_seen_at,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', pk.id, 'name', pk.name, 'price', pk.price,
                                                     'duration_minutes', pk.duration_minutes, 'num_photos', pk.num_photos)
                                   ORDER BY pk.price ASC)
                   FROM packages pk WHERE pk.photographer_id = pp.id AND pk.is_public = TRUE),
                  '[]'::json
                ) as packages
         FROM photographer_profiles pp
         JOIN users u ON u.id = pp.user_id
         JOIN photographer_locations pl ON pl.photographer_id = pp.id
         WHERE pp.is_approved = TRUE AND pl.location_slug = $1
         ORDER BY pp.is_featured DESC, pp.rating DESC NULLS LAST, pp.review_count DESC, RANDOM()
         LIMIT 6`,
        [city]
      ).catch(() => []);

  const photographers: LPPhotographer[] = rows.map((r) => ({
    ...r,
    packages: Array.isArray(r.packages) ? r.packages : [],
  }));

  const minPriceRow = await queryOne<{ min_price: string | null }>(
    `SELECT MIN(pk.price) as min_price
     FROM packages pk
     JOIN photographer_profiles pp ON pp.id = pk.photographer_id
     JOIN photographer_locations pl ON pl.photographer_id = pp.id
     WHERE pp.is_approved = TRUE AND pk.is_public = TRUE AND pl.location_slug = $1
       ${shootTypeAliases ? "AND pp.shoot_types && $2::text[]" : ""}`,
    shootTypeAliases ? [city, shootTypeAliases] : [city]
  ).catch(() => null);
  const minPrice = minPriceRow?.min_price ? Math.round(parseFloat(minPriceRow.min_price)) : null;

  // Pass-through UTM so Book CTA preserves attribution
  const bookParams = new URLSearchParams();
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "gclid"] as const) {
    const v = (sp as Record<string, string | undefined>)[k];
    if (v) bookParams.set(k, v);
  }
  const utmQuery = bookParams.toString();

  const shootLabel = st?.name || "Professional";
  const heroTitle = `${shootLabel} Photographers in ${loc.name}`;
  const heroSubtitle = minPrice
    ? `Hand-picked, verified photographers — from €${minPrice}. Book instantly, pay securely.`
    : "Hand-picked, verified photographers — book instantly, pay securely.";

  return (
    <div className="bg-warm-50 min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-warm-200">
        <div className="absolute inset-0 z-0">
          <OptimizedImage src={locationImage(city, "hero")} alt="" className="h-full w-full opacity-30" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-warm-50/70 via-warm-50/90 to-warm-50" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:px-8">
          <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl lg:text-5xl">
            {heroTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            {heroSubtitle}
          </p>
          {/* Trust strip */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Secure payment
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Money-back guarantee
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Instant confirmation
            </span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:px-8">
        {/* Scarcity banner */}
        {photographers.length > 0 && (
          <ScarcityBanner count={photographers.length} locationName={loc.name} locale={locale} />
        )}

        {/* Photographer cards */}
        {photographers.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-8 text-center">
            <p className="text-gray-600">
              {st ? `No ${st.name.toLowerCase()} photographers yet in ${loc.name}.` : `No photographers yet in ${loc.name}.`}
            </p>
            <Link href="/find-photographer" className="mt-4 inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              Let us match you with the right photographer
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {photographers.map((p, idx) => {
              const firstPkg = p.packages[0];
              const href = `/photographers/${p.slug}${utmQuery ? `?${utmQuery}` : ""}`;
              return (
                <article key={p.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  {/* Cover */}
                  <Link href={href} className="block h-44 overflow-hidden bg-warm-100">
                    {p.cover_url ? (
                      <OptimizedImage src={p.cover_url} alt={`${normalizeName(p.name)} portfolio`} priority={idx < 3} className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary-100 to-warm-200" />
                    )}
                    {p.is_founding && (
                      <span className="absolute left-3 top-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                        Founding
                      </span>
                    )}
                  </Link>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white bg-primary-100">
                        {p.avatar_url ? (
                          <OptimizedImage src={p.avatar_url} alt={normalizeName(p.name)} className="h-12 w-12" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center text-base font-bold text-primary-600">
                            {normalizeName(p.name).charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={href} className="block">
                          <h3 className="flex items-center gap-1 truncate text-base font-bold text-gray-900 group-hover:text-primary-700">
                            {normalizeName(p.name)}
                            {p.is_verified && (
                              <svg className="h-4 w-4 shrink-0 text-accent-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                              </svg>
                            )}
                          </h3>
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs">
                          {p.review_count > 0 && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                              <span className="font-semibold text-gray-900">{Number(p.rating).toFixed(1)}</span>
                              <span className="text-gray-400">({p.review_count})</span>
                            </span>
                          )}
                          <ActiveBadge lastSeenAt={p.last_seen_at} size="sm" />
                        </div>
                        {p.tagline && (
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.tagline}</p>
                        )}
                      </div>
                    </div>

                    {/* Package CTAs */}
                    {p.packages.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {p.packages.slice(0, 2).map((pkg) => (
                          <Link
                            key={pkg.id}
                            href={`/book/${p.slug}?package=${pkg.id}${utmQuery ? `&${utmQuery}` : ""}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-warm-200 bg-warm-50 px-3.5 py-2.5 text-sm transition hover:border-primary-400 hover:bg-primary-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-gray-900 group-hover:text-primary-700">{pkg.name}</p>
                              <p className="truncate text-[11px] text-gray-500">
                                {pkg.duration_minutes >= 60 ? `${pkg.duration_minutes / 60}h` : `${pkg.duration_minutes}min`} · {pkg.num_photos} photos
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-bold text-gray-900">€{Math.round(Number(pkg.price))}</span>
                              <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                            </div>
                          </Link>
                        ))}
                        {p.packages.length > 2 && (
                          <Link href={href} className="block text-center text-xs font-medium text-primary-600 hover:underline">
                            View all {p.packages.length} packages →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={href}
                        className="mt-4 block rounded-xl border border-warm-200 bg-warm-50 px-4 py-2.5 text-center text-sm font-semibold text-primary-700 transition hover:border-primary-400 hover:bg-primary-50"
                      >
                        View profile →
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Fallback: "not seeing the right match?" */}
        {photographers.length > 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-warm-200 bg-white p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-semibold text-gray-900">Need help choosing?</p>
              <p className="mt-0.5 text-sm text-gray-500">Tell us what you need and we&apos;ll send 2-3 hand-picked matches.</p>
            </div>
            <Link href={`/find-photographer${utmQuery ? `?${utmQuery}` : ""}`} className="inline-flex shrink-0 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              Free concierge matching
            </Link>
          </div>
        )}

        {/* How it works strip */}
        <div className="mt-10 grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 sm:grid-cols-3 sm:gap-6">
          {[
            { n: "1", title: "Pick a package", desc: "See real photographers in " + loc.name + " with real prices." },
            { n: "2", title: "Book instantly", desc: "Secure payment — held in escrow until delivery." },
            { n: "3", title: "Get your photos", desc: "Edited high-res photos delivered privately." },
          ].map((s) => (
            <div key={s.n} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                {s.n}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function generateStaticParams() {
  return locations.map((l) => ({ city: l.slug }));
}

// Suppress TS warning — shootTypes imported for type validation in generateMetadata
void shootTypes;
