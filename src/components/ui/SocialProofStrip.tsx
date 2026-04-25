"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { locations as ALL_LOCATIONS } from "@/lib/locations-data";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Link } from "@/i18n/navigation";

const FLAG_MAP: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", NL: "🇳🇱", CA: "🇨🇦", DE: "🇩🇪", BE: "🇧🇪",
  NO: "🇳🇴", AU: "🇦🇺", FR: "🇫🇷", IT: "🇮🇹", BR: "🇧🇷", SE: "🇸🇪",
  ES: "🇪🇸", CH: "🇨🇭", FI: "🇫🇮", IE: "🇮🇪", IN: "🇮🇳", SG: "🇸🇬",
  AE: "🇦🇪", MX: "🇲🇽", PL: "🇵🇱", DK: "🇩🇰", AT: "🇦🇹", CZ: "🇨🇿",
  RO: "🇷🇴", BG: "🇧🇬", TH: "🇹🇭", VN: "🇻🇳", CN: "🇨🇳",
};

const FALLBACK_COUNTRIES = ["US", "GB", "NL", "CA", "DE", "BE", "NO", "AU", "FR", "IT", "BR", "SE", "ES", "CH", "FI", "IE", "IN", "SG", "AE", "MX"];

// Simplemaps Portugal mainland bbox (in 1000x601 viewBox): x:835-955, y:27-271
// Real lat/lng: lng -9.5 to -6.1 (W→E), lat 36.9 to 42.2 (S→N)
function latLngToSvg(lat: number, lng: number) {
  const x = 835 + ((lng - -9.5) / 3.4) * 120;
  const y = 27 + ((42.2 - lat) / 5.3) * 244;
  return { x, y };
}

export function SocialProofStrip({
  countryCodes,
  photographerCount,
  locationCount,
  avatars,
  locationSlugs,
  texts,
}: {
  countryCodes: string[];
  photographerCount: number;
  locationCount: number;
  avatars: { slug: string; avatar_url: string; name: string }[];
  locationSlugs: string[];
  texts: {
    trustedBy: string;
    photographers: string;
    locations: string;
    securePayment: string;
    islandsCovered: string;
  };
}) {
  const locale = useLocale();
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const [hoveredPin, setHoveredPin] = useState<{ slug: string; name: string; x: number; y: number } | null>(null);
  const codes = countryCodes.length > 0 ? countryCodes : FALLBACK_COUNTRIES;

  // Map viewBox: "820 20 140 260" → convert SVG coords to % within the container for tooltip positioning.
  const vbX = 820, vbY = 20, vbW = 140, vbH = 260;
  const pinToPct = (x: number, y: number) => ({
    leftPct: ((x - vbX) / vbW) * 100,
    topPct: ((y - vbY) / vbH) * 100,
  });
  const flagCodes = codes.filter((c) => FLAG_MAP[c]);
  const flagsVisible = flagCodes.slice(0, 19);
  const flagsRemaining = Math.max(0, flagCodes.length - flagsVisible.length);

  const avatarsVisible = avatars.slice(0, 19);
  const avatarRemaining = Math.max(0, photographerCount - avatarsVisible.length);

  const mainlandDots = ALL_LOCATIONS
    .filter((l) => l.lat >= 36.5 && l.lat <= 42.5 && l.lng >= -9.8 && l.lng <= -6.0)
    .map((l) => ({ ...latLngToSvg(l.lat, l.lng), slug: l.slug, name: l.name }));

  const madeiraCovered = locationSlugs.includes("madeira");
  const azoresCovered = locationSlugs.includes("azores");

  return (
    <section className="border-y border-warm-200 bg-warm-50/50 py-8 sm:py-14 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Mobile: compact stats only — 3 columns, no visuals (overkill on small screens) */}
        <div className="grid grid-cols-3 gap-3 text-center sm:hidden">
          <div>
            <p className="font-display text-3xl font-bold text-gray-900">{photographerCount}</p>
            <p className="mt-1 text-xs text-gray-500 font-medium leading-tight">{texts.photographers}</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-primary-600">{codes.length}+</p>
            <p className="mt-1 text-xs text-gray-500 font-medium leading-tight">{texts.trustedBy}</p>
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-gray-900">{locationCount}</p>
            <p className="mt-1 text-xs text-gray-500 font-medium leading-tight">{texts.locations}</p>
          </div>
        </div>

        {/* Desktop: 3 columns, each = stat + its visual grouped together */}
        <div className="hidden sm:grid grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Column 1 — photographers */}
          <div className="flex flex-col items-center text-center">
            <p className="font-display text-5xl lg:text-6xl font-bold text-gray-900">{photographerCount}</p>
            <p className="mt-1 text-sm lg:text-base text-gray-500 font-medium">{texts.photographers}</p>
            <div className="mt-10 grid grid-cols-5 gap-2 max-w-[280px]">
              {avatarsVisible.map((a, i) => (
                <Link
                  key={i}
                  href={`/photographers/${a.slug}`}
                  className="h-12 w-12 lg:h-[52px] lg:w-[52px] overflow-hidden rounded-full border-2 border-white bg-warm-100 shadow-sm transition hover:scale-110 hover:shadow-md"
                  aria-label={`View profile of ${a.name}`}
                >
                  <OptimizedImage src={a.avatar_url} alt={`${a.name} — photographer in Portugal`} width={120} className="h-full w-full object-cover" />
                </Link>
              ))}
              {avatarRemaining > 0 && (
                <Link
                  href="/photographers"
                  className="flex h-12 w-12 lg:h-[52px] lg:w-[52px] items-center justify-center rounded-full border-2 border-white bg-primary-600 text-xs font-bold text-white shadow-sm transition hover:scale-110 hover:bg-primary-700"
                  aria-label="Browse all photographers"
                >
                  +{avatarRemaining}
                </Link>
              )}
            </div>
          </div>

          {/* Column 2 — countries */}
          <div className="flex flex-col items-center text-center">
            <p className="font-display text-5xl lg:text-6xl font-bold text-primary-600">{codes.length}+</p>
            <p className="mt-1 text-sm lg:text-base text-gray-500 font-medium">{texts.trustedBy}</p>
            <div className="mt-10 grid grid-cols-5 gap-2 max-w-[280px]">
              {flagsVisible.map((code) => (
                <div
                  key={code}
                  className="flex h-12 w-12 lg:h-[52px] lg:w-[52px] items-center justify-center rounded-full border-2 border-white bg-white text-2xl shadow-sm transition hover:scale-110"
                  title={code}
                >
                  {FLAG_MAP[code]}
                </div>
              ))}
              {flagsRemaining > 0 && (
                <div className="flex h-12 w-12 lg:h-[52px] lg:w-[52px] items-center justify-center rounded-full border-2 border-white bg-primary-600 text-xs font-bold text-white shadow-sm">
                  +{flagsRemaining}
                </div>
              )}
            </div>
          </div>

          {/* Column 3 — locations */}
          <div className="flex flex-col items-center text-center">
            <p className="font-display text-5xl lg:text-6xl font-bold text-gray-900">{locationCount}</p>
            <p className="mt-1 text-sm lg:text-base text-gray-500 font-medium">{texts.locations}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="relative w-[130px] lg:w-[150px]">
                <svg viewBox="820 20 140 260" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <image href="/portugal-map.svg" x="0" y="0" width="1000" height="601" style={{ opacity: 0.85 }} />
                  {mainlandDots.map((d) => {
                    const isActive = hoveredPin?.slug === d.slug;
                    return (
                      <a
                        key={d.slug}
                        href={`${localePrefix}/locations/${d.slug}`}
                        className="cursor-pointer focus:outline-none"
                        onMouseEnter={() => setHoveredPin({ slug: d.slug, name: d.name, x: d.x, y: d.y })}
                        onMouseLeave={() => setHoveredPin(null)}
                        onFocus={() => setHoveredPin({ slug: d.slug, name: d.name, x: d.x, y: d.y })}
                        onBlur={() => setHoveredPin(null)}
                      >
                        <circle cx={d.x} cy={d.y} r={8} fill="transparent" />
                        <circle cx={d.x} cy={d.y} r={isActive ? 7 : 5} fill="#C94536" opacity={isActive ? 0.35 : 0.22} style={{ transition: "r 0.15s, opacity 0.15s" }} />
                        <circle cx={d.x} cy={d.y} r={isActive ? 3.5 : 2.5} fill="#C94536" style={{ transition: "r 0.15s" }} />
                        <circle cx={d.x} cy={d.y} r={0.9} fill="#FFFFFF" />
                      </a>
                    );
                  })}
                </svg>
                {/* Custom tooltip — positioned as % over the SVG container so it scales with the map. */}
                {hoveredPin && (() => {
                  const { leftPct, topPct } = pinToPct(hoveredPin.x, hoveredPin.y);
                  return (
                    <div
                      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
                      style={{ left: `${leftPct}%`, top: `${topPct}%`, paddingBottom: "12px" }}
                    >
                      <div className="relative whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                        {hoveredPin.name}
                        <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-px border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  + {texts.islandsCovered}
                </p>
                <Link
                  href={madeiraCovered ? "/locations/madeira" : "#"}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${madeiraCovered ? "border-accent-200 bg-accent-50 hover:bg-accent-100" : "border-warm-200 bg-white pointer-events-none"}`}
                  aria-disabled={!madeiraCovered}
                >
                  <svg className={`h-3 w-3 ${madeiraCovered ? "text-accent-600" : "text-warm-300"}`} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2c-4.97 0-9 4.03-9 9 0 6.75 9 13 9 13s9-6.25 9-13c0-4.97-4.03-9-9-9zm0 12a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  <span className={`text-xs font-semibold ${madeiraCovered ? "text-accent-700" : "text-gray-500"}`}>Madeira</span>
                </Link>
                <Link
                  href={azoresCovered ? "/locations/azores" : "#"}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${azoresCovered ? "border-accent-200 bg-accent-50 hover:bg-accent-100" : "border-warm-200 bg-white pointer-events-none"}`}
                  aria-disabled={!azoresCovered}
                >
                  <svg className={`h-3 w-3 ${azoresCovered ? "text-accent-600" : "text-warm-300"}`} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2c-4.97 0-9 4.03-9 9 0 6.75 9 13 9 13s9-6.25 9-13c0-4.97-4.03-9-9-9zm0 12a3 3 0 110-6 3 3 0 010 6z" />
                  </svg>
                  <span className={`text-xs font-semibold ${azoresCovered ? "text-accent-700" : "text-gray-500"}`}>Azores</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
