"use client";

import { useState, useMemo } from "react";
import { PhotographerProfile, Location } from "@/types";
import { PhotographerCard } from "@/components/photographers/PhotographerCard";

interface Props {
  photographers: PhotographerProfile[];
  locations: Location[];
  shootTypes: string[];
  initialLocation?: string;
  initialShootType?: string;
}

const PRICE_MAX = 5000;

export function PhotographerCatalog({
  photographers,
  locations,
  shootTypes,
  initialLocation,
  initialShootType,
}: Props) {
  const [locationFilters, setLocationFilters] = useState<string[]>(initialLocation ? [initialLocation] : []);
  const [locationSearch, setLocationSearch] = useState("");
  const [shootTypeFilters, setShootTypeFilters] = useState<string[]>(initialShootType ? [initialShootType] : []);
  const [languageFilter, setLanguageFilter] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [sortBy, setSortBy] = useState<"featured" | "rating" | "price-low" | "price-high" | "reviews">("featured");
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

    if (priceMin > 0 || priceMax < PRICE_MAX) {
      result = result.filter((p) => {
        if (p.packages.length === 0) return false;
        const cheapest = Math.min(...p.packages.map((pkg) => pkg.price));
        return cheapest >= priceMin && (priceMax >= PRICE_MAX ? true : cheapest <= priceMax);
      });
    }

    // Sort
    const featuredFirst = (a: PhotographerProfile, b: PhotographerProfile) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    };

    switch (sortBy) {
      case "featured":
        result = [...result].sort((a, b) => featuredFirst(a, b) || b.rating - a.rating || b.review_count - a.review_count);
        break;
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
  }, [photographers, locationFilters, shootTypeFilters, languageFilter, priceMin, priceMax, sortBy]);

  const priceFilterActive = priceMin > 0 || priceMax < PRICE_MAX;
  const activeFilterCount =
    locationFilters.length +
    shootTypeFilters.length +
    (languageFilter ? 1 : 0) +
    (priceFilterActive ? 1 : 0);

  const selectedLocationNames = locationFilters
    .map((s) => locations.find((l) => l.slug === s)?.name)
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">
          {selectedLocationNames.length === 1
            ? `Photographers in ${selectedLocationNames[0]}`
            : selectedLocationNames.length > 1
            ? `Photographers in ${selectedLocationNames.length} locations`
            : "Find Your Photographer"}
        </h1>
        <p className="mt-2 text-gray-500">
          {filtered.length} photographer{filtered.length !== 1 ? "s" : ""} available
        </p>
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
                ? "All locations"
                : locationFilters.length === 1
                ? selectedLocationNames[0]
                : `${locationFilters.length} locations`}
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
                      onClick={() => { setLocationFilters([]); setLocationSearch(""); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locationFilters.length === 0 ? "font-semibold text-primary-600" : "text-gray-600"}`}
                    >
                      All locations
                    </button>
                    {filteredLocations.map((loc) => (
                      <button
                        key={loc.slug}
                        onClick={() => toggleLocation(loc.slug)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${locationFilters.includes(loc.slug) ? "font-semibold text-primary-600" : "text-gray-600"}`}
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
            <option value="">Any language</option>
            {allLanguages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Price range */}
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
            priceFilterActive ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-700"
          }`}>
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <input
              type="number"
              min={0}
              max={priceMax}
              value={priceMin || ""}
              onChange={(e) => setPriceMin(Math.min(Number(e.target.value) || 0, priceMax))}
              placeholder="0"
              className="w-14 bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              min={priceMin}
              max={PRICE_MAX}
              value={priceMax >= PRICE_MAX ? "" : priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value) || PRICE_MAX)}
              placeholder={`${PRICE_MAX}+`}
              className="w-14 bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-gray-400">&euro;</span>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="featured">Featured</option>
            <option value="rating">Top Rated</option>
            <option value="reviews">Most Reviews</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
          </select>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); setPriceMin(0); setPriceMax(PRICE_MAX); }}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
            >
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Shoot type pills (multi-select) */}
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
            onClick={() => { setLocationFilters([]); setShootTypeFilters([]); setLanguageFilter(""); setPriceMin(0); setPriceMax(PRICE_MAX); }}
            className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
