import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBusinessPhotos } from "@/lib/business-showcase";
import { r2SrcSet, variantUrl } from "@/lib/image-variants";
import { country } from "@/lib/country";

/** Homepage B2B band — same visual grammar as the homepage's dark CTA
 *  section (bg-gray-900 + font-display heading + primary CTA). Deliberately
 *  compact: the homepage sells consumer shoots; this is a signpost, not a
 *  second hero.
 *
 *  It used to be a flat charcoal slab with a lot of dead space to the right
 *  of the copy. Real corporate work now fills it: one photo bleeds across the
 *  background under a heavy scrim, and the rest sit as a small strip beside
 *  the CTA — a company scanning the homepage sees we actually shoot this,
 *  instead of a claim. With no business photos on file the band degrades to
 *  exactly the old charcoal slab. */
export async function ForBusinessBand() {
  const t = await getTranslations("business.band");
  const photos = await getBusinessPhotos(4);
  const [backdrop, ...strip] = photos;

  return (
    <section className="relative isolate overflow-hidden bg-gray-900">
      {backdrop && (
        <>
          {/* Backdrop is decorative — the copy carries the meaning, so it's
              intentionally alt-empty and pushed behind everything. */}
          {/* This is a SERVER component: srcSet/sizes are strings and safe to
              render here, but never add an onError (or any function prop) —
              that exact mistake 500'd every page on 2026-08-14. The band sits
              at the bottom of the page, so both images are lazy: on phones
              (where this used to eager-load ~250 kB before any scroll) it now
              costs nothing until the visitor actually gets here. */}
          <img
            src={backdrop}
            srcSet={r2SrcSet(backdrop, country.filesHost)}
            sizes="100vw"
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-40"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-900/60"
            aria-hidden
          />
        </>
      )}
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-12 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
        <div>
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-warm-200 backdrop-blur-sm">
            {t("kicker")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{t("title")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300">{t("text")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-4 sm:items-end">
          {strip.length > 0 && (
            <div className="flex gap-2" aria-hidden>
              {strip.map((url) => (
                // The 400 rung served directly: these chips draw at 64-80px,
                // so 400 covers any dpr up to 5x, and each one replaces a
                // 350-500 kB portfolio original with ~25 kB. No srcset needed
                // for a fixed-size slot; coverage of the rung is guaranteed by
                // the DB-wide verifier plus generation on upload.
                <img
                  key={url}
                  src={variantUrl(url, 400)}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/20 sm:h-20 sm:w-20"
                />
              ))}
            </div>
          )}
          <Link
            href={"/for-business" as never}
            className="rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
