import { getTranslations } from "next-intl/server";

export async function ScarcityBanner({
  count,
  locationName,
  locale,
  context = "location",
}: {
  count: number;
  locationName: string;
  locale: string;
  context?: "location" | "shootType";
}) {
  const t = await getTranslations({ locale, namespace: "scarcity" });
  const isFew = count <= 3;
  const headline =
    context === "shootType"
      ? isFew
        ? t("shootTypeFew", { count, location: locationName })
        : t("shootTypeMany", { location: locationName })
      : isFew
      ? t("locationFew", { count, location: locationName })
      : t("locationMany", { location: locationName });
  const body = t("body");

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg" aria-hidden>
        ⚡
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">{headline}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{body}</p>
      </div>
    </div>
  );
}
