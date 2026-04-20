"use client";

import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PhotographerProfile, Location } from "@/types";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { trackSearch } from "@/lib/analytics";

function TeamOnlineIndicator() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Portugal time (Europe/Lisbon)
  const ptHour = parseInt(now.toLocaleString("en-US", { timeZone: "Europe/Lisbon", hour: "numeric", hour12: false }));
  const isOnline = ptHour >= 8 && ptHour < 23;

  if (isOnline) {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Team is online now
      </span>
    );
  }

  // Calculate hours until 8:00 AM Portugal time
  const ptNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  let hoursUntil: number;
  if (ptHour >= 23) {
    hoursUntil = 24 - ptHour + 8;
  } else {
    hoursUntil = 8 - ptHour;
  }

  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
      <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
      Team will be online in {hoursUntil}h
    </span>
  );
}

interface Props {
  photographers: PhotographerProfile[];
  quotes?: Record<string, { text: string; client_name: string | null }>;
  locations: Location[];
  shootTypes: string[];
  initialLocation?: string;
  initialShootType?: string;
}

export function PhotographerCatalog({
  photographers,
  quotes = {},
  locations,
  shootTypes,
  initialLocation,
  initialShootType,
}: Props) {
  const t = useTranslations("photographers");
  const [locationFilters, setLocationFilters] = useState<string[]>(initialLocation ? [initialLocation] : []);
  const [locationSearch, setLocationSearch] = useState("");
  const [shootTypeFilters, setShootTypeFilters] = useState<string[]>(initialShootType ? [initialShootType] : []);
  const [languageFilter, setLanguageFilter] = useState("");
  type SortKey = "featured" | "rating" | "reviews" | "newest" | "fastest";
  const [sortBy, setSortBy] = useState<SortKey>("featured");
  type BucketFlag = "rating45" | "activeWeek" | "fastReply" | "founding";
  const [bucketFlags, setBucketFlags] = useState<Set<BucketFlag>>(new Set());
  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<null | "location" | "filters">(null);

  function applyBucket(key: string) {
    if (activeBucket === key) {
      setActiveBucket(null);
      setBucketFlags(new Set());
      setSortBy("featured");
      return;
    }
    setActiveBucket(key);
    const flags = new Set<BucketFlag>();
    let sort: SortKey = "featured";
    switch (key) {
      case "popular": sort = "reviews"; break;
      case "topRated": sort = "rating"; flags.add("rating45"); break;
      case "new": sort = "newest"; break;
      case "founding": flags.add("founding"); break;
      case "fast": sort = "fastest"; flags.add("fastReply"); break;
    }
    setBucketFlags(flags);
    setSortBy(sort);
  }

  function handleSortChange(next: SortKey) {
    setActiveBucket(null);
    setSortBy(next);
  }

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    photographers.forEach((p) => p.languages.forEach((l) => langs.add(l)));
    return Array.from(langs).sort();
  }, [photographers]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const locationName = locationFilters.map((s) => locations.find((l) => l.slug === s)?.name).filter(Boolean).join(", ");
    trackSearch({ location: locationName || undefined, shootType: shootTypeFilters.join(", ") || undefined });
  }, [locationFilters, shootTypeFilters, locations]);

  // Only show locations that have at least 1 photographer
  const locationsWithPhotographers = useMemo(() => {
    const slugsWithPhotographers = new Set<string>();
    photographers.forEach((p) => p.locations.forEach((l) => slugsWithPhotographers.add(l.slug)));
    return locations.filter((l) => slugsWithPhotographers.has(l.slug));
  }, [locations, photographers]);

  const filteredLocations = useMemo(() => {
    const list = !locationSearch
      ? locationsWithPhotographers
      : locationsWithPhotographers.filter((l) =>
          l.name.toLowerCase().includes(locationSearch.toLowerCase())
        );
    return [...list].sort((a, b) => {
      if (a.slug === "lisbon") return -1;
      if (b.slug === "lisbon") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [locationsWithPhotographers, locationSearch]);

  function toggleLocation(slug: string) {
    setLocationFilters((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleShootType(type: string) {
    setShootTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  const filtered = useMemo(() => {
    let result = photographers;

    if (locationFilters.length > 0) {
      result = result.filter((p) =>
        p.locations.some((l) => locationFilters.includes(l.slug))
      );
    }

    if (shootTypeFilters.length > 0) {
      result = result.filter((p) =>
        shootTypeFilters.some((t) => p.shoot_types.includes(t))
      );
    }

    if (languageFilter) {
      result = result.filter((p) =>
        p.languages.includes(languageFilter)
      );
    }

    // Bucket-driven flags
    if (bucketFlags.has("rating45")) {
      result = result.filter((p) => Number(p.rating) >= 4.5 && p.review_count > 0);
    }
    if (bucketFlags.has("activeWeek")) {
      const oneWeekAgo = Date.now() - 7 * 86400e3;
      result = result.filter((p) => p.last_seen_at && new Date(p.last_seen_at).getTime() >= oneWeekAgo);
    }
    if (bucketFlags.has("fastReply")) {
      result = result.filter((p) => p.avg_response_minutes != null && p.avg_response_minutes <= 60);
    }
    if (bucketFlags.has("founding")) {
      result = result.filter((p) => p.is_founding);
    }

    // Sort
    const featuredFirst = (a: PhotographerProfile, b: PhotographerProfile) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    };

    switch (sortBy) {
      case "featured":
        result = [...result].sort((a, b) => featuredFirst(a, b) || (Math.random() - 0.5));
        break;
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
        break;
      case "reviews":
        result = [...result].sort((a, b) => b.review_count - a.review_count);
        break;
      case "newest":
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "fastest":
        result = [...result].sort((a, b) => {
          const am = a.avg_response_minutes ?? Number.MAX_SAFE_INTEGER;
          const bm = b.avg_response_minutes ?? Number.MAX_SAFE_INTEGER;
          return am - bm;
        });
        break;
    }

    return result;
  }, [photographers, locationFilters, shootTypeFilters, languageFilter, bucketFlags, sortBy]);

  const secondaryCount = shootTypeFilters.length + (languageFilter ? 1 : 0);
  const activeFilterCount = locationFilters.length + secondaryCount;

  const BUCKETS: { key: string; label: string; icon: string }[] = [
    { key: "popular", label: t("buckets.popular"), icon: "🔥" },
    { key: "topRated", label: t("buckets.topRated"), icon: "⭐" },
    { key: "new", label: t("buckets.new"), icon: "🆕" },
    { key: "founding", label: t("buckets.founding"), icon: "💎" },
    { key: "fast", label: t("buckets.fast"), icon: "⚡" },
  ];

  const selectedLocationNames = locationFilters
    .map((s) => locations.find((l) => l.slug === s)?.name)
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Mobile compact header (< sm only) */}
      <div className="sm:hidden">
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {selectedLocationNames.length === 1
            ? t("photographersIn", { location: selectedLocationNames[0] || "" })
            : selectedLocationNames.length > 1
            ? t("photographersInMultiple", { count: selectedLocationNames.length })
            : t("findYourPhotographer")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {filtered.length === 1
            ? t("available", { count: filtered.length })
            : t("availablePlural", { count: filtered.length })}
        </p>
      </div>

      {/* Mobile sticky filter bar (< sm only) */}
      <div className="sticky top-16 z-20 -mx-4 mt-3 border-b border-warm-200 bg-warm-50/95 px-4 py-2 backdrop-blur sm:hidden">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setMobileSheet("location")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              locationFilters.length > 0 ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {locationFilters.length === 0
              ? t("filters.allLocations")
              : locationFilters.length === 1
              ? selectedLocationNames[0]
              : t("filters.locations", { count: locationFilters.length })}
          </button>
          <button
            onClick={() => setMobileSheet("filters")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              (shootTypeFilters.length + (languageFilter ? 1 : 0)) > 0 ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t("filters.mobileFilters")}
            {(shootTypeFilters.length + (languageFilter ? 1 : 0)) > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                {shootTypeFilters.length + (languageFilter ? 1 : 0)}
              </span>
            )}
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="shrink-0 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none"
          >
            <option value="featured">{t("filters.sortFeatured")}</option>
            <option value="rating">{t("filters.sortTopRated")}</option>
            <option value="reviews">{t("filters.sortMostReviews")}</option>
            <option value="newest">{t("filters.sortNewest")}</option>
            <option value="fastest">{t("filters.sortFastest")}</option>
          </select>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); setBucketFlags(new Set()); setActiveBucket(null); }}
              className="shrink-0 rounded-full px-3 py-2 text-sm text-gray-500"
            >
              {t("filters.clearAllShort")}
            </button>
          )}
        </div>
      </div>

      {/* Desktop header + concierge (>= sm) */}
      <div className="hidden flex-col gap-4 sm:flex lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            {selectedLocationNames.length === 1
              ? t("photographersIn", { location: selectedLocationNames[0] || "" })
              : selectedLocationNames.length > 1
              ? t("photographersInMultiple", { count: selectedLocationNames.length })
              : t("findYourPhotographer")}
          </h1>
          <p className="mt-2 text-gray-500">
            {filtered.length === 1
              ? t("available", { count: filtered.length })
              : t("availablePlural", { count: filtered.length })}
          </p>
          <p className="mt-1 text-sm text-gray-400">{t("trustLine")}</p>
        </div>

        <a href="/find-photographer" className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-5 py-4 shadow-lg backdrop-blur-xl transition hover:shadow-xl hover:bg-white/90 lg:w-1/2 lg:shrink-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-md">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{t("concierge.title")}</p>
            <p className="text-xs text-gray-500">{t("concierge.desc")}</p>
            <TeamOnlineIndicator />
          </div>
          <svg className="h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </a>
      </div>

      {/* Seasonal urgency — April to September */}
      {(() => {
        const month = new Date().getMonth(); // 0-indexed
        return month >= 3 && month <= 8 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Summer season is filling up — book early to secure your preferred date
          </p>
        ) : null;
      })()}

      {/* Buckets row — curated quick shortcuts (all viewports) */}
      <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {BUCKETS.map((b) => {
          const active = activeBucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => applyBucket(b.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                active
                  ? "border-primary-500 bg-primary-600 text-white shadow-sm"
                  : "border-warm-200 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-700"
              }`}
            >
              <span aria-hidden>{b.icon}</span>
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Desktop filter bar (>= sm) */}
      <div className="mt-4 hidden space-y-3 sm:block">
        {/* Top row: Location + Language + Price + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Location dropdown with multi-select */}
          <div className="relative">
            <button
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                locationFilters.length > 0 ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {locationFilters.length === 0
                ? t("filters.allLocations")
                : locationFilters.length === 1
                ? selectedLocationNames[0]
                : t("filters.locations", { count: locationFilters.length })}
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLocationDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLocationDropdown(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-warm-200 bg-white shadow-lg">
                  <div className="p-2">
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder={t("filters.searchLocations")}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto px-1 pb-1">
                    <button
                      onClick={() => { setLocationFilters([]); setLocationSearch(""); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locationFilters.length === 0 ? "font-semibold text-primary-600" : "text-gray-600"}`}
                    >
                      {t("filters.allLocations")}
                    </button>
                    {filteredLocations.map((loc, idx) => (
                      <div key={loc.slug}>
                        <button
                          onClick={() => toggleLocation(loc.slug)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locationFilters.includes(loc.slug) ? "font-semibold text-primary-600" : loc.slug === "lisbon" ? "font-bold text-gray-800" : "text-gray-600"}`}
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            locationFilters.includes(loc.slug) ? "border-primary-500 bg-primary-500" : "border-gray-300"
                          }`}>
                            {locationFilters.includes(loc.slug) && (
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          {loc.name}
                        </button>
                        {loc.slug === "lisbon" && idx < filteredLocations.length - 1 && (
                          <div className="mx-3 my-1 border-b border-warm-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* All filters — unified dropdown (occasion + language) */}
          <div className="relative">
            <button
              onClick={() => setShowFiltersDropdown((o) => !o)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                secondaryCount > 0 ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {t("filters.allFilters")}
              {secondaryCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                  {secondaryCount}
                </span>
              )}
              <svg className={`h-3.5 w-3.5 text-gray-400 transition ${showFiltersDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFiltersDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFiltersDropdown(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-warm-200 bg-white p-4 shadow-lg">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("filters.occasion")}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {shootTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleShootType(type)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            shootTypeFilters.includes(type)
                              ? "bg-primary-600 text-white"
                              : "bg-warm-100 text-gray-600 hover:bg-warm-200"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("filters.language")}</h4>
                    <select
                      value={languageFilter}
                      onChange={(e) => setLanguageFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400"
                    >
                      <option value="">{t("filters.anyLanguage")}</option>
                      {allLanguages.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  {secondaryCount > 0 && (
                    <div className="mt-4 flex justify-end border-t border-warm-100 pt-3">
                      <button
                        onClick={() => { setShootTypeFilters([]); setLanguageFilter(""); }}
                        className="text-xs font-medium text-primary-600 hover:underline"
                      >
                        {t("filters.clearAllShort")}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortKey)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="featured">{t("filters.sortFeatured")}</option>
            <option value="rating">{t("filters.sortTopRated")}</option>
            <option value="reviews">{t("filters.sortMostReviews")}</option>
            <option value="newest">{t("filters.sortNewest")}</option>
            <option value="fastest">{t("filters.sortFastest")}</option>
          </select>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); setBucketFlags(new Set()); setActiveBucket(null); }}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
            >
              {t("filters.clearAll", { count: activeFilterCount })}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((photographer, idx) => (
          <Fragment key={photographer.id}>
            <PhotographerCard photographer={photographer} quote={quotes[photographer.id]} />
            {idx === 2 && filtered.length > 3 && (
              <a
                href="/find-photographer"
                className="flex items-center gap-3 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-accent-50 p-5 shadow-sm transition hover:shadow-md sm:hidden"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-md">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{t("concierge.title")}</p>
                  <p className="text-xs text-gray-500">{t("concierge.desc")}</p>
                  <TeamOnlineIndicator />
                </div>
                <svg className="h-4 w-4 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </Fragment>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warm-100">
            <svg className="h-8 w-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">{t("noMatch")}</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            {t("noMatchSuggestion")}
          </p>
          <button
            onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); }}
            className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {t("filters.clearAllFilters")}
          </button>
        </div>
      )}

      {/* Mobile bottom sheet (< sm) */}
      {mobileSheet && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSheet(null)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-900">
                {mobileSheet === "location" ? t("filters.allLocations") : t("filters.mobileFilters")}
              </h2>
              <button
                onClick={() => setMobileSheet(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-warm-50 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {mobileSheet === "location" ? (
                <>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    placeholder={t("filters.searchLocations")}
                    className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
                  />
                  <button
                    onClick={() => { setLocationFilters([]); setLocationSearch(""); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${locationFilters.length === 0 ? "bg-primary-50 font-semibold text-primary-700" : "text-gray-600"}`}
                  >
                    {t("filters.allLocations")}
                  </button>
                  {filteredLocations.map((loc, idx) => (
                    <div key={loc.slug}>
                      <button
                        onClick={() => toggleLocation(loc.slug)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${locationFilters.includes(loc.slug) ? "bg-primary-50 font-semibold text-primary-700" : loc.slug === "lisbon" ? "font-bold text-gray-800" : "text-gray-600"}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          locationFilters.includes(loc.slug) ? "border-primary-500 bg-primary-500" : "border-gray-300"
                        }`}>
                          {locationFilters.includes(loc.slug) && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        {loc.name}
                      </button>
                      {loc.slug === "lisbon" && idx < filteredLocations.length - 1 && (
                        <div className="mx-3 my-1 border-b border-warm-200" />
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("filters.occasion")}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {shootTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleShootType(type)}
                          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                            shootTypeFilters.includes(type)
                              ? "bg-primary-600 text-white"
                              : "bg-warm-100 text-gray-600"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("filters.language")}</h3>
                    <select
                      value={languageFilter}
                      onChange={(e) => setLanguageFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 outline-none"
                    >
                      <option value="">{t("filters.anyLanguage")}</option>
                      {allLanguages.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 border-t border-warm-100 px-4 py-3">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); setLocationSearch(""); setBucketFlags(new Set()); setActiveBucket(null); }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700"
                >
                  {t("filters.clearAllShort")}
                </button>
              )}
              <button
                onClick={() => setMobileSheet(null)}
                className="flex-[2] rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white"
              >
                {filtered.length === 1
                  ? t("filters.showResults", { count: filtered.length })
                  : t("filters.showResultsPlural", { count: filtered.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
