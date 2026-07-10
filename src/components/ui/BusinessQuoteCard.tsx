import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Render-only "business" card in the profile package list — NOT a real
 * packages row (a DB pseudo-package would leak into min-price, JSON-LD,
 * concierge context and checkout). Styled to sit naturally among real
 * PackageCards (same chrome: rounded-xl, warm border, white bg). Shown only
 * while the photographer has the 'Business' shoot type enabled (their
 * opt-out switch, on by default). CTA leads to the business inquiry form
 * with the photographer preselected.
 */
export async function BusinessQuoteCard({ photographerSlug }: { photographerSlug: string }) {
  const t = await getTranslations("business");

  return (
    <Link
      href={`/for-business?photographer=${photographerSlug}` as never}
      className="group flex flex-col h-full rounded-xl border border-warm-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <h3 className="font-bold text-gray-900 group-hover:text-primary-700">
        {t("profileCardTitle")}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {t("profileCardBlurb")}
      </p>
      <div className="mt-auto pt-4">
        <span className="block w-full rounded-xl bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition group-hover:bg-gray-800">
          {t("profileCardCta")}
        </span>
      </div>
    </Link>
  );
}
