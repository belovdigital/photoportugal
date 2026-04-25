import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { MatchQuickForm } from "@/components/ui/MatchQuickForm";

export interface HeroFeaturedPhotographer {
  slug: string;
  name: string;
  tagline: string | null;
  cover_url: string | null;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  session_count: number;
  location_name: string;
  location_slug: string;
}

// Variant B — hero centred on ONE photographer instead of a marketplace grid.
// Personalises first impression: visitor sees a real person, not a catalog.
export async function HeroSingleVariant({ photographer }: {
  photographer: HeroFeaturedPhotographer;
}) {
  const t = await getTranslations("heroSingle");
  const firstName = photographer.name.split(" ")[0];
  const primaryCover = photographer.cover_url || photographer.avatar_url || "/hero-family.webp";
  const displayRating = photographer.rating > 0 ? photographer.rating.toFixed(1) : null;

  return (
    <section className="relative overflow-hidden bg-gray-900">
      {/* Background: big photographer cover photo */}
      <div className="absolute inset-0">
        <OptimizedImage
          src={primaryCover}
          alt={t("coverAlt", { name: photographer.name, location: photographer.location_name })}
          width={2000}
          quality={90}
          sizes="100vw"
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/85 via-gray-950/65 to-gray-950/30" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          {/* Availability / credibility chip */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {t("availableChip", { location: photographer.location_name })}
          </div>

          {/* Headline: "Meet {name}" */}
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
            {t.rich("headline", {
              name: (chunks) => <span className="text-primary-400">{chunks}</span>,
              br: () => <br className="hidden sm:inline" />,
              firstName,
              location: photographer.location_name,
            })}
          </h1>

          {photographer.tagline && (
            <p className="mt-5 max-w-xl text-lg italic text-white/85">
              &ldquo;{photographer.tagline}&rdquo;
            </p>
          )}

          {/* Photographer avatar + stats row */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {photographer.avatar_url && (
              <Link href={`/photographers/${photographer.slug}`} className="group flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40 transition group-hover:ring-white">
                  <OptimizedImage src={photographer.avatar_url} alt={photographer.name} width={120} className="h-full w-full" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-white group-hover:underline">{photographer.name}</p>
                  <p className="text-white/70 text-xs">{t("viewProfile")} →</p>
                </div>
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {displayRating && (
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <strong>{displayRating}</strong>
                  {photographer.review_count > 0 && <span className="text-white/70">{t("reviewsCount", { count: photographer.review_count })}</span>}
                </span>
              )}
              {photographer.session_count > 0 && (
                <span className="text-white/80">{t.rich("shootsCompleted", { count: photographer.session_count, strong: (chunks) => <strong className="text-white">{chunks}</strong> })}</span>
              )}
            </div>
          </div>

          {/* Quick match form (same as variant A) */}
          <div className="mt-7 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t("matchPrompt", { firstName })}
            </p>
            <MatchQuickForm source="homepage_hero_b" size="md" />
          </div>

          {/* Safety net: "browse 30+ photographers" link */}
          <p className="mt-4 text-sm text-white/70">
            {t.rich("browseAll", {
              link: (chunks) => (
                <Link href="/photographers" className="font-semibold text-white underline underline-offset-2 hover:text-primary-300">{chunks}</Link>
              ),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
