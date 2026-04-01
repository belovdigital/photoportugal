"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PhotographerProfile, Location } from "@/types";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";
import { trackSearch } from "@/lib/analytics";

interface Props {
  photographers: PhotographerProfile[];
  locations: Location[];
  shootTypes: string[];
  initialLocation?: string;
  initialShootType?: string;
}

export function PhotographerCatalog({
  photographers,
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
  const [sortBy, setSortBy] = useState<"featured" | "rating" | "reviews">("featured");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

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

  const filteredLocations = useMemo(() => {
    const list = !locationSearch
      ? locations
      : locations.filter((l) =>
          l.name.toLowerCase().includes(locationSearch.toLowerCase())
        );
    return [...list].sort((a, b) => {
      if (a.slug === "lisbon") return -1;
      if (b.slug === "lisbon") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [locations, locationSearch]);

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

    // Sort
    const featuredFirst = (a: PhotographerProfile, b: PhotographerProfile) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    };

    switch (sortBy) {
      case "featured":
        // Featured first (random within), then rest (random within)
        result = [...result].sort((a, b) => featuredFirst(a, b) || (Math.random() - 0.5));
        break;
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
        break;
      case "reviews":
        result = [...result].sort((a, b) => b.review_count - a.review_count);
        break;
    }

    return result;
  }, [photographers, locationFilters, shootTypeFilters, languageFilter, sortBy]);

  const activeFilterCount =
    locationFilters.length +
    shootTypeFilters.length +
    (languageFilter ? 1 : 0);

  const selectedLocationNames = locationFilters
    .map((s) => locations.find((l) => l.slug === s)?.name)
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
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

      {/* Filter bar */}
      <div className="mt-6 space-y-3">
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

          {/* Language select */}
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
              languageFilter ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700"
            }`}
          >
            <option value="">{t("filters.anyLanguage")}</option>
            {allLanguages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="featured">{t("filters.sortFeatured")}</option>
            <option value="rating">{t("filters.sortTopRated")}</option>
            <option value="reviews">{t("filters.sortMostReviews")}</option>
          </select>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); }}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
            >
              {t("filters.clearAll", { count: activeFilterCount })}
            </button>
          )}
        </div>

        {/* Shoot type pills (multi-select) */}
        <div className="flex flex-wrap gap-1.5">
          {shootTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleShootType(type)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
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

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((photographer) => (
          <PhotographerCard key={photographer.id} photographer={photographer} />
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
    </div>
  );
}
