import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBusinessPhotographers } from "@/lib/business-showcase";
import { maskSurname } from "@/lib/photographer-name";
import { normalizeName } from "@/lib/format-name";
import { PhotographerCardCover } from "@/components/ui/PhotographerCardCover";

/**
 * Proof section for the B2B landing: the photographers who have actually
 * shot corporate work, each card headed by a swipeable strip of that work
 * only. Everyone whose Business toggle is on would be a longer list and a
 * weaker claim — the toggle ships enabled, so it says nothing.
 *
 * Renders nothing at all while no corporate photos exist, rather than
 * showing an empty shelf.
 */
export async function BusinessPhotographers({ serifClass }: { serifClass: string }) {
  const t = await getTranslations("business");
  const photographers = await getBusinessPhotographers(6);
  if (photographers.length === 0) return null;

  return (
    <section className="border-t border-[#1F1B17]/10 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#1F1B17]/55">
          {t("photographersKicker")}
        </p>
        <h2 className={`${serifClass} mt-4 text-4xl font-medium sm:text-5xl`}>{t("photographersTitle")}</h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#1F1B17]/65">{t("photographersText")}</p>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {photographers.map((p) => {
            const displayName = normalizeName(maskSurname(p.name));
            return (
              <article key={p.slug} className="flex flex-col">
                <PhotographerCardCover
                  slug={p.slug}
                  name={displayName}
                  thumbnails={p.photos}
                  height="h-64"
                  impressionSurface="for_business"
                />
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <h3 className={`${serifClass} text-2xl font-medium`}>{displayName}</h3>
                  {p.review_count > 0 && (
                    <span className="shrink-0 text-sm text-[#1F1B17]/55">
                      ★ {Number(p.rating).toFixed(1)} ({p.review_count})
                    </span>
                  )}
                </div>
                {p.locations.length > 0 && (
                  <p className="mt-1 text-[13px] uppercase tracking-[0.18em] text-[#1F1B17]/45">
                    {p.locations.slice(0, 3).join(" · ")}
                  </p>
                )}
                <Link
                  href={`/photographers/${p.slug}`}
                  className="mt-4 self-start border-b border-[#1F1B17]/30 pb-0.5 text-sm font-semibold transition hover:border-[#1F1B17]"
                >
                  {t("photographersCta")}
                </Link>
              </article>
            );
          })}
        </div>

        <Link
          href={"/photographers?shootType=Business" as never}
          className="mt-12 inline-block border-b border-[#1F1B17]/30 pb-0.5 text-sm font-semibold transition hover:border-[#1F1B17]"
        >
          {t("photographersAll")}
        </Link>
      </div>
    </section>
  );
}
