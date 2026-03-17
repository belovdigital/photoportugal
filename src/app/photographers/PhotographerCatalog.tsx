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
  initialShootType?: string;
}

const PRICE_RANGES = [
  { label: "Any price", min: 0, max: Infinity },
  { label: "Under €150", min: 0, max: 150 },
  { label: "€150 – €200", min: 150, max: 200 },
  { label: "€200+", min: 200, max: Infinity },
];

export function PhotographerCatalog({
  photographers,
  locations,
  shootTypes,
  initialLocation,
  initialShootType,
}: Props) {
  const [locationFilter, setLocationFilter] = useState(initialLocation || "");
  const [locationSearch, setLocationSearch] = useState("");
  const [shootTypeFilter, setShootTypeFilter] = useState(initialShootType || "");
  const [languageFilter, setLanguageFilter] = useState("");
  const [priceRange, setPriceRange] = useState(0);
  const [sortBy, setSortBy] = useState<"rating" | "price-low" | "price-high" | "reviews">("rating");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    photographers.forEach((p) => p.languages.forEach((l) => langs.add(l)));
    return Array.from(langs).sort();
  }, [photographers]);

  const filteredLocations = useMemo(() => {
    if (!locationSearch) return locations;
    return locations.filter((l) =>
      l.name.toLowerCase().includes(locationSearch.toLowerCase())
    );
  }, [locations, locationSearch]);

  const filtered = useMemo(() => {
    let result = photographers;

    if (locationFilter) {
      result = result.filter((p) =>
        p.locations.some((l) => l.slug === locationFilter)
      );
    }

    if (shootTypeFilter) {
      result = result.filter((p) =>
        p.shoot_types.includes(shootTypeFilter)
      );
    }

    if (languageFilter) {
      result = result.filter((p) =>
        p.languages.includes(languageFilter)
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

    switch (sortBy) {
      case "rating":
        result = [...result].sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
        break;
      case "price-low":
        result = [...result].sort((a, b) => {
          const aMin = a.packages.length ? Math.min(...a.packages.map((p) => p.price)) : Infinity;
          const bMin = b.packages.length ? Math.min(...b.packages.map((p) => p.price)) : Infinity;
          return aMin - bMin;
        });
        break;
      case "price-high":
        result = [...result].sort((a, b) => {
          const aMin = a.packages.length ? Math.min(...a.packages.map((p) => p.price)) : 0;
          const bMin = b.packages.length ? Math.min(...b.packages.map((p) => p.price)) : 0;
          return bMin - aMin;
        });
        break;
      case "reviews":
        result = [...result].sort((a, b) => b.review_count - a.review_count);
        break;
    }

    return result;
  }, [photographers, locationFilter, shootTypeFilter, languageFilter, priceRange, sortBy]);

  const activeFilterCount =
    (locationFilter ? 1 : 0) +
    (shootTypeFilter ? 1 : 0) +
    (languageFilter ? 1 : 0) +
    (priceRange > 0 ? 1 : 0);

  const selectedLocationName = locations.find((l) => l.slug === locationFilter)?.name;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">
          {selectedLocationName
            ? `Photographers in ${selectedLocationName}`
            : "Find Your Photographer"}
        </h1>
        <p className="mt-2 text-gray-500">
          {filtered.length} photographer{filtered.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* Compact filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* Location dropdown with search */}
        <div className="relative">
          <button
            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              locationFilter ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {selectedLocationName || "All locations"}
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showLocationDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowLocationDropdown(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-warm-200 bg-white shadow-lg">
                <div className="p-2">
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto px-1 pb-1">
                  <button
                    onClick={() => { setLocationFilter(""); setShowLocationDropdown(false); setLocationSearch(""); }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${!locationFilter ? "font-semibold text-primary-600" : "text-gray-600"}`}
                  >
                    All locations
                  </button>
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.slug}
                      onClick={() => { setLocationFilter(loc.slug); setShowLocationDropdown(false); setLocationSearch(""); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locationFilter === loc.slug ? "font-semibold text-primary-600" : "text-gray-600"}`}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Shoot type select */}
        <select
          value={shootTypeFilter}
          onChange={(e) => setShootTypeFilter(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
            shootTypeFilter ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700"
          }`}
        >
          <option value="">All shoot types</option>
          {shootTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Language select */}
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
            languageFilter ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700"
          }`}
        >
          <option value="">Any language</option>
          {allLanguages.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {/* Price select */}
        <select
          value={priceRange}
          onChange={(e) => setPriceRange(parseInt(e.target.value))}
          className={`rounded-lg border px-3 py-2 text-sm outline-none transition ${
            priceRange > 0 ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700"
          }`}
        >
          {PRICE_RANGES.map((r, i) => (
            <option key={r.label} value={i}>{r.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
        >
          <option value="rating">Top Rated</option>
          <option value="reviews">Most Reviews</option>
          <option value="price-low">Price: Low → High</option>
          <option value="price-high">Price: High → Low</option>
        </select>

        {/* Clear */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setLocationFilter(""); setShootTypeFilter(""); setLanguageFilter(""); setPriceRange(0); }}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
          >
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((photographer) => (
          <PhotographerCard key={photographer.id} photographer={photographer} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg text-gray-500">No photographers match your filters.</p>
          <button
            onClick={() => { setLocationFilter(""); setShootTypeFilter(""); setLanguageFilter(""); setPriceRange(0); }}
            className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
