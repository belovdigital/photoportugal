"use client";

import { BLIND_COMPARE_AT_EUR } from "@/lib/blind-booking/pricing";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { QuickBookingTrigger } from "@/components/ui/QuickBookingModal";
import { resolveImageUrl } from "@/lib/image-url";
import { country } from "@/lib/country";

/**
 * Hero for a market whose roster is still empty.
 *
 * The normal hero (`HeroSingleVariant`) is built around one live photographer —
 * their name, rating and portfolio carousel — and is wrapped in
 * `{heroPhotographer && …}`. In a new country that query returns nothing, so the
 * page opened straight into the value-prop section with no hero at all.
 *
 * This carries the same weight (large imagery, the summer offer, one primary
 * CTA) while claiming nothing about a roster that does not exist yet: no
 * photographer name, no rating, no count. The moment a first photographer is
 * approved, the regular hero takes over.
 *
 * Deliberately no <h1>: the page's H1 lives in the value-prop section below.
 * An earlier version repeated that headline here and the page rendered the same
 * title and paragraph twice in a row.
 *
 * Copy comes from the existing `heroSingle` namespace — those keys already
 * exist in all five locales, so there is no chance of shipping a raw key path
 * (see CLAUDE.md).
 */
export function BrandHero({ photos }: { photos: string[] }) {
  const t = useTranslations("heroSingle");
  // "Browse Photographers" — plain string; heroSingle.browseAll is rich text with
  // an embedded link and cannot be used as a button label.
  const tHome = useTranslations("home");
  const shots = photos.filter(Boolean).slice(0, 3);
  const [lead, ...rest] = shots;

  return (
    <section className="relative overflow-hidden bg-gray-900">
      {/* Lead photo fills the section; the copy sits over a scrim so text
          contrast survives whatever image happens to be first. */}
      {lead && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveImageUrl(lead)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-8 lg:py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            {country.brand}
          </p>

          <div className="mt-5 max-w-lg rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              ☀️ {t("offerKicker")}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
              {t("offerTitle", { price: "€279" })}{" "}
              {/* From the constant, not a copy of it: the €5 rounding of
                  2026-08-09 moved this 344 -> 345 and the hardcodes did not
                  follow, so the strike-through disagreed with the promo bar
                  directly above it. */}
              <s className="font-semibold text-white/60">&euro;{BLIND_COMPARE_AT_EUR[60]}</s>
            </p>
            <p className="mt-2 text-sm text-white/80">{t("offerSub")}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <QuickBookingTrigger className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-700">
                {t("offerCta")} →
              </QuickBookingTrigger>
              <Link
                href="/photographers"
                className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {tHome("heroBrowse")}
              </Link>
            </div>
          </div>
        </div>

        {/* Two supporting shots, desktop only — on a phone the background image
            is already doing this job and three more downloads are not worth it. */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-2">
          {rest.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={resolveImageUrl(url)}
              alt=""
              loading="lazy"
              decoding="async"
              className={`aspect-[3/4] w-full rounded-2xl object-cover shadow-2xl ${i === 1 ? "mt-8" : ""}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
