"use client";

import { useState, useMemo } from "react";
import { PhotographerProfile, Location } from "@/types";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";

interface Props {
  photographers: PhotographerProfile[];
  locations: Location[];
  regions: string[];
  shootTypes: string[];
  initialLocation?: string;
}

const PRICE_RANGES = [
  { label: "Any price", min: 0, max: Infinity },
  { label: "Under €150", min: 0, max: 150 },
  { label: "€150 – €200", min: 150, max: 200 },
  { label: "€200 – €300", min: 200, max: 300 },
  { label: "€300+", min: 300, max: Infinity },
];

const MIN_RATINGS = [
  { label: "Any rating", value: 0 },
  { label: "4.5+", value: 4.5 },
  { label: "4.8+", value: 4.8 },
  { label: "5.0 only", value: 5.0 },
];

export function PhotographerCatalog({
  photographers,
  locations,
  regions,
  shootTypes,
  initialLocation,
}: Props) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    initialLocation ? [initialLocation] : []
  );
  const [selectedShootTypes, setSelectedShootTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "price-low" | "price-high" | "reviews">("rating");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Collect all unique languages from photographers
  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    photographers.forEach((p) => p.languages.forEach((l) => langs.add(l)));
    return Array.from(langs).sort();
  }, [photographers]);

  const filtered = useMemo(() => {
    let result = photographers;

    if (selectedLocations.length > 0) {
      result = result.filter((p) =>
        p.locations.some((l) => selectedLocations.includes(l.slug))
      );
    }

    if (selectedShootTypes.length > 0) {
      result = result.filter((p) =>
        selectedShootTypes.some((st) => p.shoot_types.includes(st))
      );
    }

    if (selectedLanguages.length > 0) {
      result = result.filter((p) =>
        selectedLanguages.some((lang) => p.languages.includes(lang))
      );
    }

    const range = PRICE_RANGES[priceRange];
    if (range && (range.max !== Infinity || range.min > 0)) {
      result = result.filter((p) => {
        if (p.packages.length === 0) return false;
        const cheapest = Math.min(...p.packages.map((pkg) => pkg.price));
        return cheapest >= range.min && cheapest <= range.max;
      });
    }

    if (minRating > 0) {
      result = result.filter((p) => p.rating >= minRating);
    }

    if (verifiedOnly) {
      result = result.filter((p) => p.is_verified);
    }

    // Sort
    switch (sortBy) {
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
        break;
      case "price-low":
        result = [...result].sort((a, b) => {
          const aMin = Math.min(...a.packages.map((p) => p.price));
          const bMin = Math.min(...b.packages.map((p) => p.price));
          return aMin - bMin;
        });
        break;
      case "price-high":
        result = [...result].sort((a, b) => {
          const aMin = Math.min(...a.packages.map((p) => p.price));
          const bMin = Math.min(...b.packages.map((p) => p.price));
          return bMin - aMin;
        });
        break;
      case "reviews":
        result = [...result].sort((a, b) => b.review_count - a.review_count);
        break;
    }

    return result;
  }, [photographers, selectedLocations, selectedShootTypes, selectedLanguages, priceRange, minRating, verifiedOnly, sortBy]);

  function toggleItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  function clearAll() {
    setSelectedLocations([]);
    setSelectedShootTypes([]);
    setSelectedLanguages([]);
    setPriceRange(0);
    setMinRating(0);
    setVerifiedOnly(false);
  }

  const activeFilterCount =
    selectedLocations.length +
    selectedShootTypes.length +
    selectedLanguages.length +
    (priceRange > 0 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  const filterContent = (
    <>
      {/* Locations by region */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Location</h3>
        {regions.map((region) => (
          <div key={region} className="mt-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {region}
            </p>
            <div className="mt-1.5 space-y-1">
              {locations
                .filter((l) => l.region === region)
                .map((loc) => (
                  <label
                    key={loc.slug}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-warm-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(loc.slug)}
                      onChange={() => toggleItem(selectedLocations, loc.slug, setSelectedLocations)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{loc.name}</span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      <hr className="border-warm-200" />

      {/* Shoot Type */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Shoot Type</h3>
        <div className="mt-3 space-y-1">
          {shootTypes.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-warm-100"
            >
              <input
                type="checkbox"
                checked={selectedShootTypes.includes(type)}
                onChange={() => toggleItem(selectedShootTypes, type, setSelectedShootTypes)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-warm-200" />

      {/* Languages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Languages</h3>
        <div className="mt-3 space-y-1">
          {allLanguages.map((lang) => (
            <label
              key={lang}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-warm-100"
            >
              <input
                type="checkbox"
                checked={selectedLanguages.includes(lang)}
                onChange={() => toggleItem(selectedLanguages, lang, setSelectedLanguages)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{lang}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-warm-200" />

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Price Range</h3>
        <div className="mt-3 space-y-1">
          {PRICE_RANGES.map((range, i) => (
            <label
              key={range.label}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-warm-100"
            >
              <input
                type="radio"
                name="price"
                checked={priceRange === i}
                onChange={() => setPriceRange(i)}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-warm-200" />

      {/* Rating */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Minimum Rating</h3>
        <div className="mt-3 space-y-1">
          {MIN_RATINGS.map((r) => (
            <label
              key={r.label}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-warm-100"
            >
              <input
                type="radio"
                name="rating"
                checked={minRating === r.value}
                onChange={() => setMinRating(r.value)}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-warm-200" />

      {/* Verified */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-warm-100">
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={() => setVerifiedOnly(!verifiedOnly)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm font-medium text-gray-700">Verified only</span>
      </label>

      {activeFilterCount > 0 && (
        <button
          onClick={clearAll}
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Find Your Photographer
          </h1>
          <p className="mt-2 text-gray-500">
            {filtered.length} photographer{filtered.length !== 1 ? "s" : ""} available
            {selectedLocations.length > 0 && (
              <> in {selectedLocations.map((s) => locations.find((l) => l.slug === s)?.name).filter(Boolean).join(", ")}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-primary-500"
          >
            <option value="rating">Top Rated</option>
            <option value="reviews">Most Reviews</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-6 rounded-2xl border border-warm-200 bg-white p-6">
            <h2 className="text-base font-bold text-gray-900">Filters</h2>
            {filterContent}
          </div>
        </aside>

        {/* Mobile filters drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="text-gray-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                {filterContent}
              </div>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Show {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((photographer) => (
              <PhotographerCard key={photographer.id} photographer={photographer} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-lg text-gray-500">No photographers match your filters.</p>
              <button
                onClick={clearAll}
                className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
