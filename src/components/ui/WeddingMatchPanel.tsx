"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { trackCTAClick } from "@/lib/analytics";
import { LocationTreeSelect } from "@/components/ui/LocationTreeSelect";

// Where + When picker for the /weddings landing. The WHERE field is our
// shared tree dropdown (same component the photographer catalog uses), so
// it covers every region/city, not just the curated destinations.
//
// Routing: a slug that has a real location page becomes the wedding combo
// page (/locations/[slug]/wedding); a region/grouping/spot node that has
// no page routes to the photographer catalog filtered to that area +
// wedding, so the picker can never land on a 404.
//
// All labels arrive as props — the landing keeps its strings inline per
// locale, nothing reads messages/*.json here.

export interface WeddingMonthOption {
  value: string;
  label: string;
}

export function WeddingMatchPanel({
  comboSlugs,
  availableSlugs,
  months,
  labels,
  variant = "light",
  source,
}: {
  /** Location slugs that have a real /locations/[slug] page (combo target). */
  comboSlugs: string[];
  /** Legacy location slugs covered by wedding photographers — the dropdown
   *  hides everything else so couples can't pick an empty location. */
  availableSlugs: string[];
  months: WeddingMonthOption[];
  labels: {
    where: string;
    wherePlaceholder: string;
    whereSearch: string;
    whereNoMatch: string;
    when: string;
    whenPlaceholder: string;
    cta: string;
  };
  variant?: "light" | "dark";
  /** Analytics suffix: weddings_hero / weddings_footer */
  source: string;
}) {
  const router = useRouter();
  const [dest, setDest] = useState("");
  const [month, setMonth] = useState("");
  const comboSet = useMemo(() => new Set(comboSlugs), [comboSlugs]);

  const isDark = variant === "dark";
  const labelCls = isDark
    ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
    : "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1F1B17]/50";

  // Underline-style button matching the editorial selects. The shared
  // dropdown's inner <span>/<svg> get color-forced via arbitrary variants
  // (its defaults are gray-900/gray-400, invisible on bordeaux).
  const triggerBtn = isDark
    ? "flex w-full items-center justify-between gap-2 border-b border-white/30 bg-transparent px-1 pb-3 pt-1 text-base [&>span]:!text-white [&>svg]:!text-white/70"
    : "flex w-full items-center justify-between gap-2 border-b border-[#1F1B17]/25 bg-transparent px-1 pb-3 pt-1 text-base [&>svg]:!text-[#1F1B17]/40";

  const monthSelectCls = isDark
    ? "w-full rounded-none border-b border-white/30 bg-transparent px-1 pb-3 pt-1 text-base text-white focus:border-white focus:outline-none [&>option]:text-gray-900"
    : "w-full rounded-none border-b border-[#1F1B17]/25 bg-transparent px-1 pb-3 pt-1 text-base text-[#1F1B17] focus:border-[#6B1F2E] focus:outline-none";

  function go() {
    if (!dest) return;
    trackCTAClick("wedding_match", source);
    if (comboSet.has(dest)) {
      router.push({
        pathname: "/locations/[slug]/[occasion]",
        params: { slug: dest, occasion: "wedding" },
        ...(month ? { query: { month } } : {}),
      });
    } else {
      // Region/grouping/spot node without its own page → catalog, filtered.
      router.push({
        pathname: "/photographers",
        query: { location: dest, shootType: "wedding" },
      });
    }
  }

  return (
    <div className="grid grid-cols-1 items-end gap-6 sm:grid-cols-[1fr_1fr_auto] sm:gap-8">
      <div>
        <span className={labelCls}>{labels.where}</span>
        <div className="mt-2">
          <LocationTreeSelect
            value={dest}
            onChange={setDest}
            placeholder={labels.wherePlaceholder}
            searchPlaceholder={labels.whereSearch}
            noMatchLabel={labels.whereNoMatch}
            availableSlugs={availableSlugs}
            buttonClassName={triggerBtn}
          />
        </div>
      </div>

      <div className="relative">
        <span className={labelCls}>{labels.when}</span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`${monthSelectCls} mt-2`}
          aria-label={labels.when}
        >
          <option value="">{labels.whenPlaceholder}</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={go}
        disabled={!dest}
        className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
          isDark
            ? "bg-white text-[#6B1F2E] hover:bg-white/90"
            : "bg-[#6B1F2E] text-white hover:bg-[#581826]"
        }`}
      >
        {labels.cta}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </button>
    </div>
  );
}
