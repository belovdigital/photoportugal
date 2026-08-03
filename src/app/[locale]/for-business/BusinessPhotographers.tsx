import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBusinessPhotographers } from "@/lib/business-showcase";
import { maskSurname } from "@/lib/photographer-name";
import { normalizeName } from "@/lib/format-name";

/**
 * Proof section for the B2B landing: the photographers who have actually
 * shot corporate work. Everyone whose Business toggle is on would be a longer
 * list and a weaker claim — the toggle ships enabled, so it says nothing.
 *
 * Names only, no thumbnails. A card carousel was tried and cut: corporate
 * portraits are shot full-length, every crop crushed the subject, and a wall
 * of half-bodies undersold the work it was supposed to prove. The photos live
 * one click away on the profile, at the size they were shot for.
 *
 * Renders nothing at all while no corporate photos exist, rather than showing
 * an empty shelf.
 */
export async function BusinessPhotographers({ serifClass }: { serifClass: string }) {
  const t = await getTranslations("business");
  const photographers = await getBusinessPhotographers(8);
  if (photographers.length === 0) return null;

  return (
    <section className="border-t border-[#1F1B17]/10 bg-white">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#1F1B17]/55">
          {t("photographersKicker")}
        </p>
        <h2 className={`${serifClass} mt-4 text-4xl font-medium sm:text-5xl`}>{t("photographersTitle")}</h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#1F1B17]/65">{t("photographersText")}</p>

        <ul className="mt-10 border-t border-[#1F1B17]/15">
          {photographers.map((p) => {
            const displayName = normalizeName(maskSurname(p.name));
            return (
              <li key={p.slug} className="border-b border-[#1F1B17]/15">
                <Link
                  href={`/photographers/${p.slug}`}
                  className="group flex flex-wrap items-baseline gap-x-5 gap-y-1 py-5 transition hover:opacity-70"
                >
                  <h3 className={`${serifClass} text-2xl font-medium sm:text-3xl`}>{displayName}</h3>
                  {p.review_count > 0 && (
                    <span className="text-sm text-[#1F1B17]/55">
                      ★ {Number(p.rating).toFixed(1)} ({p.review_count})
                    </span>
                  )}
                  {p.locations.length > 0 && (
                    <span className="text-[13px] uppercase tracking-[0.18em] text-[#1F1B17]/45">
                      {p.locations.slice(0, 3).join(" · ")}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 border-b border-[#1F1B17]/30 pb-0.5 text-sm font-semibold transition group-hover:border-[#1F1B17]">
                    {t("photographersCta")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href={"/photographers?shootType=Business" as never}
          className="mt-10 inline-block border-b border-[#1F1B17]/30 pb-0.5 text-sm font-semibold transition hover:border-[#1F1B17]"
        >
          {t("photographersAll")}
        </Link>
      </div>
    </section>
  );
}
