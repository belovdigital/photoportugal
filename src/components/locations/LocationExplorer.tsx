"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Camera, ChevronRight, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  LOCATION_EXPLORER_REGIONS,
  LOCATION_EXPLORER_SHOOT_FILTERS,
  LOCATION_EXPLORER_VIBE_FILTERS,
  type LocationExplorerChild,
} from "@/lib/location-explorer-data";

type Props = {
  locale: string;
  mapboxToken: string;
  totalPhotographers: number;
  coverageCounts: Record<string, number>;
};

type Copy = (typeof COPY)[keyof typeof COPY];

const COPY = {
  en: {
    eyebrow: "Interactive Portugal map",
    title: "Explore where to shoot in Portugal",
    subtitle: "Start with the region, then drill into cities, islands, and photo-friendly spots.",
    search: "Search regions, islands, cities...",
    all: "All",
    mainland: "Mainland",
    islands: "Islands",
    bestFor: "Best for",
    vibe: "Vibe",
    clear: "Clear",
    photographers: "photographers",
    photographer: "photographer",
    show: "Show photographers",
    coveredAreas: "Coverage inside this region",
    islandInsets: "Island insets",
    noResults: "No location matches these filters.",
    mapUnavailable: "Map is unavailable because the Mapbox token is missing.",
    portugalWide: "Portugal-wide coverage",
    reviewed: "Reviewed profiles",
  },
  pt: {
    eyebrow: "Mapa interativo de Portugal",
    title: "Explore onde fotografar em Portugal",
    subtitle: "Comece pela região e depois veja cidades, ilhas e spots fotográficos.",
    search: "Pesquisar regiões, ilhas, cidades...",
    all: "Tudo",
    mainland: "Continente",
    islands: "Ilhas",
    bestFor: "Ideal para",
    vibe: "Estilo",
    clear: "Limpar",
    photographers: "fotógrafos",
    photographer: "fotógrafo",
    show: "Ver fotógrafos",
    coveredAreas: "Cobertura nesta região",
    islandInsets: "Ilhas",
    noResults: "Nenhuma localização corresponde aos filtros.",
    mapUnavailable: "O mapa está indisponível porque falta o token Mapbox.",
    portugalWide: "Cobertura em Portugal",
    reviewed: "Perfis revistos",
  },
  de: {
    eyebrow: "Interaktive Portugal-Karte",
    title: "Orte für Shootings in Portugal entdecken",
    subtitle: "Starten Sie mit der Region und gehen Sie dann zu Städten, Inseln und Foto-Spots.",
    search: "Regionen, Inseln, Städte suchen...",
    all: "Alle",
    mainland: "Festland",
    islands: "Inseln",
    bestFor: "Ideal fuer",
    vibe: "Stimmung",
    clear: "Zuruecksetzen",
    photographers: "Fotografen",
    photographer: "Fotograf",
    show: "Fotografen ansehen",
    coveredAreas: "Abdeckung in dieser Region",
    islandInsets: "Inseln",
    noResults: "Keine Location passt zu diesen Filtern.",
    mapUnavailable: "Die Karte ist nicht verfuegbar, weil der Mapbox-Token fehlt.",
    portugalWide: "Portugalweite Abdeckung",
    reviewed: "Gepruefte Profile",
  },
  es: {
    eyebrow: "Mapa interactivo de Portugal",
    title: "Explore donde fotografiar en Portugal",
    subtitle: "Empiece por la region y luego vea ciudades, islas y lugares para fotos.",
    search: "Buscar regiones, islas, ciudades...",
    all: "Todo",
    mainland: "Continente",
    islands: "Islas",
    bestFor: "Ideal para",
    vibe: "Estilo",
    clear: "Limpiar",
    photographers: "fotografos",
    photographer: "fotografo",
    show: "Ver fotografos",
    coveredAreas: "Cobertura dentro de esta region",
    islandInsets: "Islas",
    noResults: "Ninguna ubicacion coincide con los filtros.",
    mapUnavailable: "El mapa no esta disponible porque falta el token de Mapbox.",
    portugalWide: "Cobertura en Portugal",
    reviewed: "Perfiles revisados",
  },
  fr: {
    eyebrow: "Carte interactive du Portugal",
    title: "Explorez ou faire une seance au Portugal",
    subtitle: "Commencez par la region, puis explorez villes, iles et spots photo.",
    search: "Rechercher regions, iles, villes...",
    all: "Tout",
    mainland: "Continent",
    islands: "Iles",
    bestFor: "Ideal pour",
    vibe: "Style",
    clear: "Effacer",
    photographers: "photographes",
    photographer: "photographe",
    show: "Voir les photographes",
    coveredAreas: "Couverture dans cette region",
    islandInsets: "Iles",
    noResults: "Aucune destination ne correspond aux filtres.",
    mapUnavailable: "La carte est indisponible car le token Mapbox manque.",
    portugalWide: "Couverture au Portugal",
    reviewed: "Profils verifies",
  },
} as const;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function childMatches(child: LocationExplorerChild, query: string): boolean {
  return normalize(child.name).includes(query) || (child.children || []).some((nested) => childMatches(nested, query));
}

function countLabel(count: number, copy: Copy): string {
  if (count <= 0) return copy.portugalWide;
  return `${count} ${count === 1 ? copy.photographer : copy.photographers}`;
}

function renderChildren(
  children: LocationExplorerChild[],
  coverageCounts: Record<string, number>,
  depth = 0
): ReactNode {
  return (
    <div className={depth === 0 ? "space-y-2" : "mt-2 space-y-1.5"}>
      {children.map((child) => {
        const count = coverageCounts[child.slug] || 0;
        return (
          <div key={child.slug}>
            <div
              className="flex items-center justify-between gap-2 rounded-md border border-warm-200 bg-white px-2.5 py-2 text-sm"
              style={{ marginLeft: depth * 14 }}
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-800">{child.name}</span>
                <span className="ml-2 rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {child.type}
                </span>
              </div>
              {count > 0 && (
                <span className="shrink-0 text-xs font-medium text-emerald-700">
                  {count}
                </span>
              )}
            </div>
            {child.children?.length ? renderChildren(child.children, coverageCounts, depth + 1) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LocationExplorer({ locale, mapboxToken, totalPhotographers, coverageCounts }: Props) {
  const copy = COPY[(locale as keyof typeof COPY)] ?? COPY.en;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(LOCATION_EXPLORER_REGIONS[0]?.slug || "");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "mainland" | "islands">("all");
  const [shootFilter, setShootFilter] = useState("");
  const [vibeFilter, setVibeFilter] = useState("");

  const filteredRegions = useMemo(() => {
    const q = normalize(query.trim());
    return LOCATION_EXPLORER_REGIONS.filter((region) => {
      if (scope !== "all" && region.scope !== scope) return false;
      if (shootFilter && !region.bestFor.includes(shootFilter)) return false;
      if (vibeFilter && !region.vibes.includes(vibeFilter)) return false;
      if (!q) return true;
      return (
        normalize(region.name).includes(q)
        || normalize(region.summary).includes(q)
        || region.children.some((child) => childMatches(child, q))
      );
    });
  }, [query, scope, shootFilter, vibeFilter]);

  const selectedRegion = useMemo(
    () => LOCATION_EXPLORER_REGIONS.find((region) => region.slug === selectedSlug) || LOCATION_EXPLORER_REGIONS[0],
    [selectedSlug]
  );

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-8.25, 39.65],
      zoom: window.innerWidth < 768 ? 5.1 : 5.8,
      minZoom: 4,
      maxZoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => setMapReady(true));

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = filteredRegions.map((region) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = [
        "rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition",
        region.slug === selectedSlug
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-white bg-white text-gray-800 hover:border-primary-300",
      ].join(" ");
      markerButton.textContent = region.shortName;
      markerButton.setAttribute("aria-label", `Select ${region.name}`);
      markerButton.addEventListener("click", () => setSelectedSlug(region.slug));

      return new mapboxgl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat(region.center)
        .addTo(mapRef.current as mapboxgl.Map);
    });
  }, [filteredRegions, mapReady, selectedSlug]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedRegion) return;
    mapRef.current.flyTo({
      center: selectedRegion.center,
      zoom: selectedRegion.mapZoom,
      speed: 0.75,
      essential: false,
    });
  }, [mapReady, selectedRegion]);

  const resetFilters = () => {
    setQuery("");
    setScope("all");
    setShootFilter("");
    setVibeFilter("");
  };

  return (
    <section className="border-b border-warm-200 bg-warm-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-gray-950 sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
              {copy.subtitle}
            </p>
          </div>

          {totalPhotographers > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="rounded-lg border border-warm-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <Camera className="h-4 w-4 text-primary-600" />
                  {copy.reviewed}
                </div>
                <p className="mt-1 font-display text-3xl font-bold text-gray-950">{totalPhotographers}</p>
              </div>
              <div className="rounded-lg border border-warm-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  {copy.portugalWide}
                </div>
                <p className="mt-1 text-lg font-bold text-gray-950">
                  {copy.mainland} + {copy.islands}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-warm-200 bg-white p-3 shadow-sm lg:max-h-[680px] lg:overflow-y-auto">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="h-11 w-full rounded-lg border border-warm-200 bg-white pl-9 pr-3 text-base outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </label>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-warm-100 p-1">
              {[
                { key: "all", label: copy.all },
                { key: "mainland", label: copy.mainland },
                { key: "islands", label: copy.islands },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setScope(option.key as typeof scope)}
                  className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
                    scope === option.key ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{copy.bestFor}</p>
                {(query || scope !== "all" || shootFilter || vibeFilter) && (
                  <button type="button" onClick={resetFilters} className="text-xs font-semibold text-primary-700">
                    {copy.clear}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_EXPLORER_SHOOT_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setShootFilter(shootFilter === filter ? "" : filter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      shootFilter === filter
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-warm-200 bg-white text-gray-600 hover:border-primary-300"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{copy.vibe}</p>
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_EXPLORER_VIBE_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setVibeFilter(vibeFilter === filter ? "" : filter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      vibeFilter === filter
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-warm-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {filteredRegions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-warm-300 bg-warm-50 px-4 py-8 text-center text-sm text-gray-500">
                  {copy.noResults}
                </div>
              ) : (
                filteredRegions.map((region) => {
                  const isSelected = region.slug === selectedSlug;
                  const count = coverageCounts[region.slug] || 0;
                  return (
                    <button
                      key={region.slug}
                      type="button"
                      onClick={() => setSelectedSlug(region.slug)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-primary-300 bg-primary-50 shadow-sm"
                          : "border-warm-200 bg-white hover:border-primary-200 hover:bg-warm-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-950">{region.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{region.summary}</p>
                        </div>
                        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-primary-600" : "text-gray-300"}`} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold text-primary-700">
                          {region.scope === "islands" ? copy.islands : copy.mainland}
                        </span>
                        <span className="font-medium text-gray-500">{countLabel(count, copy)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-warm-200 bg-white shadow-sm sm:min-h-[560px]">
              {mapboxToken ? (
                <div ref={mapContainerRef} className="absolute inset-0" />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center text-sm text-gray-500">
                  {copy.mapUnavailable}
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end">
                <div className="pointer-events-auto rounded-lg border border-warm-200 bg-white/95 p-2 shadow-lg backdrop-blur">
                  <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {copy.islandInsets}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LOCATION_EXPLORER_REGIONS.filter((region) => region.scope === "islands").map((region) => (
                      <button
                        key={region.slug}
                        type="button"
                        onClick={() => setSelectedSlug(region.slug)}
                        className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                          selectedSlug === region.slug
                            ? "border-primary-600 bg-primary-600 text-white"
                            : "border-warm-200 bg-warm-50 text-gray-700 hover:border-primary-300"
                        }`}
                      >
                        {region.shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {selectedRegion && (
                <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-warm-200 bg-white/95 p-4 shadow-xl backdrop-blur md:left-4 md:right-auto md:max-w-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary-600" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                          {selectedRegion.highlight}
                        </p>
                      </div>
                      <h2 className="mt-1 font-display text-2xl font-bold text-gray-950">{selectedRegion.name}</h2>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      {countLabel(coverageCounts[selectedRegion.slug] || 0, copy)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{selectedRegion.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...selectedRegion.bestFor.slice(0, 3), ...selectedRegion.vibes.slice(0, 2)].map((tag) => (
                      <span key={tag} className="rounded-full border border-warm-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={selectedRegion.photographerHref}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 sm:w-auto"
                  >
                    {copy.show}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            {selectedRegion && (
              <aside className="rounded-xl border border-warm-200 bg-white p-4 shadow-sm xl:max-h-[560px] xl:overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{copy.coveredAreas}</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-gray-950">{selectedRegion.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{selectedRegion.summary}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-warm-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{copy.bestFor}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{selectedRegion.bestFor.slice(0, 2).join(", ")}</p>
                  </div>
                  <div className="rounded-lg bg-warm-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{copy.vibe}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{selectedRegion.vibes.slice(0, 2).join(", ")}</p>
                  </div>
                </div>

                <div className="mt-4">
                  {renderChildren(selectedRegion.children, coverageCounts)}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
