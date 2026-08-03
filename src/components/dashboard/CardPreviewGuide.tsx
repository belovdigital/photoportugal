"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { maskSurname } from "@/lib/photographer-name";
import { normalizeName } from "@/lib/format-name";

/**
 * "This is your card, this is what a visitor decides on."
 *
 * Photographers see their profile page constantly and their CARD almost
 * never — yet the card is the whole decision. Measured 2026-08-03: the
 * platform's card CTR is 3.5%, and the ten photographers sitting at zero
 * clicks on 50+ impressions were the ones whose cover had no faces, no
 * recognisable Portugal, or marketing text baked into the image, while
 * the clicked ones all showed faces in a place you can name.
 *
 * So: render the card the way the catalog renders it, and put the rules
 * next to it — auto-checking everything that can be checked (cover
 * exists, landscape crop, tagline, a package to price against, reviews)
 * and leaving the three judgement calls as reminders.
 */
export function CardPreviewGuide({
  name,
  tagline,
  coverUrl,
  positionY,
  minPrice,
  reviewCount,
  rating,
}: {
  name: string;
  tagline: string;
  coverUrl: string | null;
  positionY: number;
  minPrice: number | null;
  reviewCount: number;
  rating: number;
}) {
  const t = useTranslations("cardPreview");
  // Landscape vs portrait is only knowable once the browser has the file.
  const [ratio, setRatio] = useState<number | null>(null);

  const checks: { key: string; ok: boolean | null }[] = [
    { key: "cover", ok: Boolean(coverUrl) },
    { key: "landscape", ok: ratio === null ? null : ratio >= 1.2 },
    { key: "tagline", ok: tagline.trim().length > 0 },
    { key: "price", ok: minPrice !== null },
    { key: "reviews", ok: reviewCount > 0 },
  ];
  const reminders = ["faces", "place", "noText"];

  return (
    <div className="rounded-2xl border border-warm-200 bg-warm-50 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{t("title")}</h3>
      <p className="mt-1 text-xs text-gray-500">{t("subtitle")}</p>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
        {/* The card itself, built like the catalog builds it */}
        <div className="overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm">
          <div className="relative h-44 bg-warm-100">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: `center ${positionY}%` }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalHeight > 0) setRatio(img.naturalWidth / img.naturalHeight);
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                {t("noCover")}
              </div>
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold text-gray-900">{maskSurname(normalizeName(name))}</p>
            <p className="mt-0.5 line-clamp-2 min-h-8 text-xs text-gray-500">
              {tagline.trim() || t("noTagline")}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {reviewCount > 0 ? `★ ${rating.toFixed(1)} · ${reviewCount}` : t("noReviewsYet")}
              </span>
              <span className="font-semibold text-gray-900">
                {minPrice !== null ? t("fromPrice", { price: minPrice }) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* The rules, with everything checkable already checked */}
        <div>
          <ul className="space-y-1.5 text-xs">
            {checks.map((c) => (
              <li key={c.key} className="flex gap-2">
                <span className={c.ok === false ? "text-primary-600" : c.ok === null ? "text-gray-300" : "text-accent-600"}>
                  {c.ok === false ? "✗" : c.ok === null ? "•" : "✓"}
                </span>
                <span className={c.ok === false ? "text-gray-900" : "text-gray-500"}>
                  {c.ok === false ? t(`check_${c.key}_bad`) : t(`check_${c.key}`)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium text-gray-700">{t("judgementTitle")}</p>
          <ul className="mt-1 space-y-1.5 text-xs text-gray-500">
            {reminders.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-warm-500">•</span>
                <span>{t(`remind_${r}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{t("evidence")}</p>
        </div>
      </div>
    </div>
  );
}
