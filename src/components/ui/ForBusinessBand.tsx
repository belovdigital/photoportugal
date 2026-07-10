import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Homepage B2B band — same visual grammar as the homepage's dark CTA
 *  section (bg-gray-900 + font-display heading + primary CTA). Deliberately
 *  compact: the homepage sells consumer shoots; this is a signpost, not a
 *  second hero. */
export async function ForBusinessBand() {
  const t = await getTranslations("business.band");

  return (
    <section className="bg-gray-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-12 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
        <div>
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-warm-200">
            {t("kicker")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{t("title")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300">{t("text")}</p>
        </div>
        <Link
          href={"/for-business" as never}
          className="shrink-0 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
