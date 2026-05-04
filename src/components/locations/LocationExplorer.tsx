"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type mapboxgl from "mapbox-gl";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { locationImage } from "@/lib/unsplash-images";
import {
  LOCATION_EXPLORER_REGIONS,
  LOCATION_EXPLORER_SHOOT_FILTERS,
  LOCATION_EXPLORER_VIBE_FILTERS,
  type LocationExplorerChild,
  type LocationExplorerRegion,
} from "@/lib/location-explorer-data";

type Props = {
  locale: string;
  mapboxToken: string;
  totalPhotographers: number;
  coverageCounts: Record<string, number>;
  regionPhotographers: Record<string, LocationExplorerPhotographer[]>;
};

export type LocationExplorerPhotographer = {
  slug: string;
  name: string;
  cover_url: string | null;
  rating: number;
};

const REGION_IMAGE_SLUGS: Record<string, string> = {
  "lisbon-region": "lisbon",
  "porto-north": "porto",
  "central-portugal": "nazare",
  alentejo: "evora",
  algarve: "algarve",
  madeira: "madeira",
  azores: "azores",
};

const COPY = {
  en: {
    eyebrow: "Portugal photo map",
    title: "Choose the place by feeling",
    subtitle: "Swipe through Portugal's regions, tap the map, then open photographers where the trip actually happens.",
    search: "Search Lisbon, Azores, Algarve...",
    all: "All",
    mainland: "Mainland",
    islands: "Islands",
    photographers: "photographers",
    photographer: "photographer",
    availableNow: "available now",
    show: "See photographers",
    coveredAreas: "Places inside",
    islandInsets: "Islands",
    noResults: "No location matches these filters.",
    mapUnavailable: "Map is unavailable because the Mapbox token is missing.",
    portugalWide: "Portugal-wide",
    reviewed: "Reviewed profiles",
    filters: "Filters",
    swipe: "Destinations",
  },
  pt: {
    eyebrow: "Mapa fotográfico de Portugal",
    title: "Escolha o lugar pela sensação",
    subtitle: "Explore as regiões, toque no mapa e veja fotógrafos onde a viagem acontece.",
    search: "Pesquisar Lisboa, Açores, Algarve...",
    all: "Tudo",
    mainland: "Continente",
    islands: "Ilhas",
    photographers: "fotógrafos",
    photographer: "fotógrafo",
    availableNow: "disponíveis agora",
    show: "Ver fotógrafos",
    coveredAreas: "Lugares dentro",
    islandInsets: "Ilhas",
    noResults: "Nenhuma localização corresponde aos filtros.",
    mapUnavailable: "O mapa está indisponível porque falta o token Mapbox.",
    portugalWide: "Portugal inteiro",
    reviewed: "Perfis revistos",
    filters: "Filtros",
    swipe: "Destinos",
  },
  de: {
    eyebrow: "Portugal-Fotokarte",
    title: "Waehlen Sie den Ort nach Gefuehl",
    subtitle: "Durch Regionen swipen, Karte antippen und Fotografen dort oeffnen, wo die Reise passiert.",
    search: "Lissabon, Azoren, Algarve suchen...",
    all: "Alle",
    mainland: "Festland",
    islands: "Inseln",
    photographers: "Fotografen",
    photographer: "Fotograf",
    availableNow: "jetzt verfügbar",
    show: "Fotografen ansehen",
    coveredAreas: "Orte darin",
    islandInsets: "Inseln",
    noResults: "Keine Location passt zu diesen Filtern.",
    mapUnavailable: "Die Karte ist nicht verfuegbar, weil der Mapbox-Token fehlt.",
    portugalWide: "Portugalweit",
    reviewed: "Gepruefte Profile",
    filters: "Filter",
    swipe: "Ziele",
  },
  es: {
    eyebrow: "Mapa fotografico de Portugal",
    title: "Elija el lugar por sensacion",
    subtitle: "Deslice regiones, toque el mapa y vea fotografos donde sucede el viaje.",
    search: "Buscar Lisboa, Azores, Algarve...",
    all: "Todo",
    mainland: "Continente",
    islands: "Islas",
    photographers: "fotografos",
    photographer: "fotografo",
    availableNow: "disponibles ahora",
    show: "Ver fotografos",
    coveredAreas: "Lugares dentro",
    islandInsets: "Islas",
    noResults: "Ninguna ubicacion coincide con los filtros.",
    mapUnavailable: "El mapa no esta disponible porque falta el token de Mapbox.",
    portugalWide: "Todo Portugal",
    reviewed: "Perfiles revisados",
    filters: "Filtros",
    swipe: "Destinos",
  },
  fr: {
    eyebrow: "Carte photo du Portugal",
    title: "Choisissez le lieu par l'ambiance",
    subtitle: "Faites defiler les regions, touchez la carte et ouvrez les photographes la ou le voyage se passe.",
    search: "Rechercher Lisbonne, Acores, Algarve...",
    all: "Tout",
    mainland: "Continent",
    islands: "Iles",
    photographers: "photographes",
    photographer: "photographe",
    availableNow: "disponibles maintenant",
    show: "Voir les photographes",
    coveredAreas: "Lieux inclus",
    islandInsets: "Iles",
    noResults: "Aucune destination ne correspond aux filtres.",
    mapUnavailable: "La carte est indisponible car le token Mapbox manque.",
    portugalWide: "Tout le Portugal",
    reviewed: "Profils verifies",
    filters: "Filtres",
    swipe: "Destinations",
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];
type MapboxGL = typeof mapboxgl;

type ExplorerPlace = {
  slug: string;
  name: string;
  type: LocationExplorerChild["type"];
  parentSlug: string;
  parentName: string;
  parentScope: LocationExplorerRegion["scope"];
  region: LocationExplorerRegion;
};

declare global {
  interface Window {
    mapboxgl?: MapboxGL;
    __photoPortugalMapboxPromise?: Promise<MapboxGL>;
  }
}

function loadMapbox(): Promise<MapboxGL> {
  if (typeof window === "undefined") return Promise.reject(new Error("Mapbox requires a browser"));
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (window.__photoPortugalMapboxPromise) return window.__photoPortugalMapboxPromise;

  window.__photoPortugalMapboxPromise = new Promise((resolve, reject) => {
    const existingCss = document.querySelector('link[data-photoportugal-mapbox-css="true"]');
    if (!existingCss) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/vendor/mapbox/mapbox-gl.css";
      css.dataset.photoportugalMapboxCss = "true";
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-photoportugal-mapbox="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => window.mapboxgl ? resolve(window.mapboxgl) : reject(new Error("Mapbox failed to load")));
      existingScript.addEventListener("error", () => reject(new Error("Mapbox script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/mapbox/mapbox-gl-csp.js";
    script.async = true;
    script.dataset.photoportugalMapbox = "true";
    script.onload = () => window.mapboxgl ? resolve(window.mapboxgl) : reject(new Error("Mapbox failed to load"));
    script.onerror = () => reject(new Error("Mapbox script failed to load"));
    document.head.appendChild(script);
  });

  return window.__photoPortugalMapboxPromise;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function childMatches(child: LocationExplorerRegion["children"][number], query: string): boolean {
  return normalize(child.name).includes(query) || (child.children || []).some((nested) => childMatches(nested, query));
}

function flattenRegionPlaces(region: LocationExplorerRegion, children: LocationExplorerChild[] = region.children): ExplorerPlace[] {
  return children.flatMap((child) => [
    {
      slug: child.slug,
      name: child.name,
      type: child.type,
      parentSlug: region.slug,
      parentName: region.name,
      parentScope: region.scope,
      region,
    },
    ...flattenRegionPlaces(region, child.children || []),
  ]);
}

function availableNowLabel(count: number, copy: Copy): string {
  if (count <= 0) return copy.portugalWide;
  return `${count} ${count === 1 ? copy.photographer : copy.photographers} ${copy.availableNow}`;
}

function regionImage(region: LocationExplorerRegion): string {
  return locationImage(REGION_IMAGE_SLUGS[region.slug] || region.slug, "cardLarge");
}

function placeImage(place: ExplorerPlace): string {
  return locationImage(place.slug, "cardLarge") || regionImage(place.region);
}

function localizedPath(locale: string, href: string): string {
  if (href.startsWith("http")) return href;
  if (locale === "en") return href;
  return `/${locale}${href.startsWith("/") ? href : `/${href}`}`;
}

export function LocationExplorer({ locale, mapboxToken, totalPhotographers, coverageCounts, regionPhotographers }: Props) {
  const copy = COPY[(locale as keyof typeof COPY)] ?? COPY.en;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapboxRef = useRef<MapboxGL | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const filmstripRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(LOCATION_EXPLORER_REGIONS[0]?.slug || "");
  const [locationCardOpen, setLocationCardOpen] = useState(true);
  const [locationCardPoint, setLocationCardPoint] = useState<{ left: number; top: number; anchor: "left" | "right" } | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "mainland" | "islands">("all");
  const [shootFilter, setShootFilter] = useState("");
  const [vibeFilter, setVibeFilter] = useState("");
  const [filmstripMode, setFilmstripMode] = useState<"regions" | "places">("regions");
  const [selectedPlaceSlug, setSelectedPlaceSlug] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setScope("all");
      setFilmstripMode("places");
    }
  };

  const scrollFilmstrip = (direction: -1 | 1) => {
    filmstripRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" });
  };

  const startFilmstripDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (!filmstripRef.current) return;
    dragRef.current = {
      active: true,
      startX: event.pageX,
      scrollLeft: filmstripRef.current.scrollLeft,
    };
  };

  const moveFilmstripDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !filmstripRef.current) return;
    event.preventDefault();
    filmstripRef.current.scrollLeft = dragRef.current.scrollLeft - (event.pageX - dragRef.current.startX);
  };

  const stopFilmstripDrag = () => {
    dragRef.current.active = false;
  };

  const allPlaces = useMemo(
    () => LOCATION_EXPLORER_REGIONS.flatMap((region) => flattenRegionPlaces(region)),
    []
  );

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

  const matchingPlaces = useMemo(() => {
    const q = normalize(query.trim());
    return allPlaces.filter((place) => {
      if (scope !== "all" && place.parentScope !== scope) return false;
      if (shootFilter && !place.region.bestFor.includes(shootFilter)) return false;
      if (vibeFilter && !place.region.vibes.includes(vibeFilter)) return false;
      if (!q) return true;
      return (
        normalize(place.name).includes(q)
        || normalize(place.type).includes(q)
        || normalize(place.parentName).includes(q)
      );
    });
  }, [allPlaces, query, scope, shootFilter, vibeFilter]);

  const selectedRegion = useMemo(
    () => LOCATION_EXPLORER_REGIONS.find((region) => region.slug === selectedSlug) || LOCATION_EXPLORER_REGIONS[0],
    [selectedSlug]
  );
  const selectedPlace = useMemo(
    () => allPlaces.find((place) => place.slug === selectedPlaceSlug && place.parentSlug === selectedSlug) || null,
    [allPlaces, selectedPlaceSlug, selectedSlug]
  );

  const placesForSelectedRegion = useMemo(
    () => allPlaces.filter((place) => place.parentSlug === selectedRegion.slug),
    [allPlaces, selectedRegion.slug]
  );

  const showPlaceFilmstrip = Boolean(query.trim()) || filmstripMode === "places";
  const filmstripPlaces = query.trim() ? matchingPlaces : placesForSelectedRegion;

  useEffect(() => {
    if (query.trim()) {
      const firstPlace = matchingPlaces[0];
      const selectedPlaceStillVisible = matchingPlaces.some((place) => place.slug === selectedPlaceSlug);
      if (firstPlace && !selectedPlaceStillVisible) {
        setSelectedSlug(firstPlace.parentSlug);
        setSelectedPlaceSlug(firstPlace.slug);
        setLocationCardOpen(true);
      }
      return;
    }

    if (filteredRegions.length === 0) return;
    if (!filteredRegions.some((region) => region.slug === selectedSlug)) {
      setSelectedSlug(filteredRegions[0].slug);
      setSelectedPlaceSlug("");
    }
  }, [filteredRegions, matchingPlaces, query, selectedPlaceSlug, selectedSlug]);

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    loadMapbox().then((mapboxgl) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      setMapError("");
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = mapboxToken;
      mapboxgl.workerUrl = "/vendor/mapbox/mapbox-gl-csp-worker.js";

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-8.25, 39.65],
        zoom: window.innerWidth < 768 ? 5 : 5.75,
        minZoom: 4,
        maxZoom: 11,
        attributionControl: false,
        cooperativeGestures: true,
      });

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(mapContainerRef.current);
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (event) => {
        const message = event.error?.message || "Mapbox map failed to render.";
        setMapError(message);
        console.error("Location map error:", event.error || event);
      });
      map.on("load", () => {
        setMapReady(true);
        requestAnimationFrame(() => map.resize());
        window.setTimeout(() => map.resize(), 250);
      });
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Mapbox failed to load.";
      setMapError(message);
      console.error("Location map failed:", error);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    const mapboxgl = mapboxRef.current;
    if (!mapReady || !mapRef.current || !mapboxgl) return;

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
      markerButton.addEventListener("click", () => {
        setSelectedSlug(region.slug);
        setSelectedPlaceSlug("");
        setFilmstripMode("places");
        setLocationCardOpen(true);
      });

      return new mapboxgl.Marker({ element: markerButton, anchor: "center" })
        .setLngLat(region.center)
        .addTo(mapRef.current as MapboxMap);
    });
  }, [filteredRegions, mapReady, selectedSlug]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedRegion) return;
    mapRef.current.flyTo({
      center: selectedRegion.center,
      zoom: selectedRegion.scope === "islands" ? selectedRegion.mapZoom : Math.min(selectedRegion.mapZoom, 7.7),
      offset: window.innerWidth >= 1024 ? [140, 0] : [0, 0],
      speed: 0.65,
      essential: false,
    });
  }, [mapReady, selectedRegion]);

  useEffect(() => {
    setLocationCardOpen(true);
    setPhotoIndex(0);
    setLightboxIndex(null);
  }, [selectedPlaceSlug, selectedSlug]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedRegion || filteredRegions.length === 0) {
      setLocationCardPoint(null);
      return;
    }

    const updatePoint = () => {
      const map = mapRef.current;
      if (!map) return;
      const projected = map.project(selectedRegion.center);
      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;
      const cardWidth = 460;
      const cardHeight = 500;
      const placeRight = projected.x < width - cardWidth - 48;
      const left = placeRight
        ? Math.min(projected.x + 34, width - cardWidth - 16)
        : Math.max(projected.x - cardWidth - 34, 16);
      const top = Math.min(Math.max(projected.y - cardHeight / 2, 86), Math.max(100, height - cardHeight - 240));
      setLocationCardPoint({ left, top, anchor: placeRight ? "left" : "right" });
    };

    updatePoint();
    mapRef.current.on("move", updatePoint);
    mapRef.current.on("zoom", updatePoint);
    mapRef.current.on("resize", updatePoint);
    return () => {
      mapRef.current?.off("move", updatePoint);
      mapRef.current?.off("zoom", updatePoint);
      mapRef.current?.off("resize", updatePoint);
    };
  }, [filteredRegions.length, mapReady, selectedRegion]);

  const resetFilters = () => {
    setQuery("");
    setScope("all");
    setShootFilter("");
    setVibeFilter("");
    setFilmstripMode("regions");
    setSelectedPlaceSlug("");
  };

  const selectedCount = selectedPlace
    ? coverageCounts[selectedPlace.slug] || 0
    : selectedRegion ? coverageCounts[selectedRegion.slug] || 0 : 0;
  const selectedPhotographers = selectedRegion ? regionPhotographers[selectedRegion.slug] || [] : [];
  const selectedFallbackImage = selectedPlace ? placeImage(selectedPlace) : regionImage(selectedRegion);
  const selectedPhotos = selectedRegion
    ? Array.from(new Set([
        selectedFallbackImage,
        ...selectedPhotographers.flatMap((photographer) => photographer.cover_url ? [photographer.cover_url] : []),
      ])).slice(0, 8)
    : [];
  const selectedTags = selectedRegion ? [...selectedRegion.bestFor.slice(0, 2), selectedRegion.vibes[0]].filter(Boolean) : [];
  const selectedPhotographersHref = selectedPlace
    ? localizedPath(locale, `/photographers?location=${selectedPlace.slug}`)
    : selectedRegion ? localizedPath(locale, selectedRegion.photographerHref) : "";
  const selectedTitle = selectedPlace?.name || selectedRegion.name;
  const selectedKicker = selectedPlace
    ? `${selectedPlace.type} in ${selectedPlace.parentName}`
    : selectedRegion.scope === "islands" ? copy.islands : copy.mainland;
  const selectedSummary = selectedPlace
    ? `${selectedPlace.name} is inside ${selectedPlace.parentName}. Open photographers who cover this exact place, or use the region card to browse nearby options.`
    : selectedRegion.summary;

  const showPrevPhoto = () => {
    setPhotoIndex((current) => (selectedPhotos.length > 0 ? (current - 1 + selectedPhotos.length) % selectedPhotos.length : 0));
  };

  const showNextPhoto = () => {
    setPhotoIndex((current) => (selectedPhotos.length > 0 ? (current + 1) % selectedPhotos.length : 0));
  };

  const showPrevLightboxPhoto = useCallback(() => {
    setLightboxIndex((current) => (
      current !== null && selectedPhotos.length > 0
        ? (current - 1 + selectedPhotos.length) % selectedPhotos.length
        : current
    ));
  }, [selectedPhotos.length]);

  const showNextLightboxPhoto = useCallback(() => {
    setLightboxIndex((current) => (
      current !== null && selectedPhotos.length > 0
        ? (current + 1) % selectedPhotos.length
        : current
    ));
  }, [selectedPhotos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") showPrevLightboxPhoto();
      if (event.key === "ArrowRight") showNextLightboxPhoto();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, selectedPhotos.length, showNextLightboxPhoto, showPrevLightboxPhoto]);

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-b border-warm-200 bg-warm-50">
      <style>{`
        .photoportugal-location-map .mapboxgl-ctrl-logo,
        .photoportugal-location-map .mapboxgl-ctrl-attrib,
        .photoportugal-location-map .mapboxgl-ctrl-attrib-button,
        .photoportugal-location-map .mapboxgl-control-container .mapboxgl-ctrl-bottom-left,
        .photoportugal-location-map .mapboxgl-control-container .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
      `}</style>
      <div className="relative h-[calc(100vh-64px)] min-h-[700px]">
        {mapboxToken ? (
          <div className="absolute inset-0 h-full w-full">
            <div ref={mapContainerRef} className="photoportugal-location-map h-full w-full" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-warm-100 p-8 text-center text-sm text-gray-500">
            {copy.mapUnavailable}
          </div>
        )}

        {mapError && (
          <div className="absolute right-4 top-4 z-20 max-w-sm rounded-xl border border-primary-200 bg-white/95 p-3 text-xs text-primary-700 shadow-lg">
            Interactive map could not load. Browse destinations below.
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(250,247,242,0.78)_0%,rgba(250,247,242,0.48)_20%,rgba(250,247,242,0.12)_42%,rgba(250,247,242,0)_64%),linear-gradient(0deg,rgba(250,247,242,0.86)_0%,rgba(250,247,242,0.24)_18%,rgba(250,247,242,0)_42%)]" />

        <div className="pointer-events-none relative h-full">
          <div className="pointer-events-auto absolute left-4 top-4 z-40 w-[calc(100%-2rem)] max-w-[440px] sm:left-6 sm:top-5 lg:left-8">
            <div className="rounded-2xl border border-warm-200 bg-white/90 p-2 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                  {copy.eyebrow}
                </p>
                {totalPhotographers > 0 && (
                  <span className="hidden rounded-full bg-warm-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 sm:inline-flex">
                    {totalPhotographers} pros
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    placeholder={copy.search}
                    className="h-10 w-full rounded-xl border border-warm-200 bg-white pl-9 pr-10 text-base text-gray-950 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-200"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSelectedPlaceSlug("");
                        setFilmstripMode("regions");
                      }}
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-warm-100 hover:text-gray-800"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((value) => !value)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-warm-200 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:border-primary-300 hover:text-primary-700"
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {copy.filters}
                </button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-warm-100 p-1">
                {[
                  { key: "all", label: copy.all },
                  { key: "mainland", label: copy.mainland },
                  { key: "islands", label: copy.islands },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setScope(option.key as typeof scope)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      scope === option.key ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {filtersOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-warm-200 bg-white/96 p-3 shadow-2xl backdrop-blur">
                  <div className="flex flex-wrap gap-2">
                    {[...LOCATION_EXPLORER_SHOOT_FILTERS, ...LOCATION_EXPLORER_VIBE_FILTERS].map((filter) => {
                      const isShoot = LOCATION_EXPLORER_SHOOT_FILTERS.includes(filter as (typeof LOCATION_EXPLORER_SHOOT_FILTERS)[number]);
                      const active = isShoot ? shootFilter === filter : vibeFilter === filter;
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => {
                            if (isShoot) setShootFilter(shootFilter === filter ? "" : filter);
                            else setVibeFilter(vibeFilter === filter ? "" : filter);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-primary-600 bg-primary-600 text-white"
                              : "border-warm-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700"
                          }`}
                        >
                          {filter}
                        </button>
                      );
                    })}
                  </div>
                  {(query || scope !== "all" || shootFilter || vibeFilter) && (
                    <button type="button" onClick={resetFilters} className="mt-3 text-xs font-semibold text-primary-700 underline">
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedRegion && locationCardOpen && locationCardPoint && selectedPhotos.length > 0 && filteredRegions.length > 0 && (
            <div
              className="pointer-events-auto absolute z-50 hidden w-[460px] rounded-2xl bg-white shadow-2xl lg:block"
              style={{ left: locationCardPoint.left, top: locationCardPoint.top }}
            >
              <div
                className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 bg-white ${
                  locationCardPoint.anchor === "left" ? "-left-2.5" : "-right-2.5"
                }`}
              />
              <button
                type="button"
                onClick={() => setLocationCardOpen(false)}
                className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition hover:bg-white hover:text-gray-950"
                aria-label="Close location card"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="overflow-hidden rounded-2xl">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(photoIndex)}
                    className="block aspect-[16/9] w-full overflow-hidden bg-warm-100 text-left"
                    aria-label={`Open ${selectedTitle} photo`}
                  >
                    <OptimizedImage
                      src={selectedPhotos[photoIndex]}
                      alt={selectedTitle}
                      width={900}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  {selectedPhotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={showPrevPhoto}
                        className="absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-primary-700 shadow transition hover:bg-white"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={showNextPhoto}
                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-primary-700 shadow transition hover:bg-white"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                        {selectedPhotos.map((photo, index) => (
                          <button
                            key={`${photo}-${index}`}
                            type="button"
                            onClick={() => setPhotoIndex(index)}
                            className={`h-1.5 rounded-full transition ${index === photoIndex ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
                            aria-label={`Show photo ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700">
                    {selectedKicker}
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-bold text-gray-950">{selectedTitle}</h2>
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {availableNowLabel(selectedCount, copy)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-600">{selectedSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-warm-200 bg-warm-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <a
                    href={selectedPhotographersHref}
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    {copy.show}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-auto absolute bottom-0 left-1/2 z-20 w-screen -translate-x-1/2">
            {(showPlaceFilmstrip ? filmstripPlaces.length : filteredRegions.length) === 0 ? (
              <div className="mx-4 mb-5 max-w-sm rounded-2xl border border-warm-200 bg-white/92 px-5 py-8 text-center text-sm text-gray-500 shadow-2xl sm:mx-6 lg:mx-8">
                {copy.noResults}
              </div>
            ) : (
              <div className="bg-gradient-to-t from-warm-50 via-warm-50/88 to-transparent px-4 pb-4 pt-14 sm:px-6 lg:px-8">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <div className="flex items-center gap-2">
                    {showPlaceFilmstrip && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setSelectedPlaceSlug("");
                          setFilmstripMode("regions");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-700 shadow-sm transition hover:border-primary-300"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        All regions
                      </button>
                    )}
                    <span>
                      {showPlaceFilmstrip
                        ? query.trim()
                          ? `Places matching "${query.trim()}"`
                          : `${selectedRegion.name} places`
                        : copy.swipe}
                    </span>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => scrollFilmstrip(-1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-warm-200 bg-white text-primary-700 shadow-sm transition hover:border-primary-300"
                      aria-label="Previous destinations"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollFilmstrip(1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-warm-200 bg-white text-primary-700 shadow-sm transition hover:border-primary-300"
                      aria-label="Next destinations"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div
                  ref={filmstripRef}
                  onMouseDown={startFilmstripDrag}
                  onMouseMove={moveFilmstripDrag}
                  onMouseUp={stopFilmstripDrag}
                  onMouseLeave={stopFilmstripDrag}
                  className="flex cursor-grab snap-x gap-3 overflow-x-auto pb-2 active:cursor-grabbing"
                >
                  {showPlaceFilmstrip
                    ? filmstripPlaces.map((place) => {
                        const isSelected = place.slug === selectedPlaceSlug;
                        const count = coverageCounts[place.slug] || 0;
                        return (
                          <button
                            key={place.slug}
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.blur();
                              setSelectedSlug(place.parentSlug);
                              setSelectedPlaceSlug(place.slug);
                              setFilmstripMode("places");
                              setLocationCardOpen(true);
                            }}
                            className={`group relative h-[118px] w-[190px] shrink-0 snap-start overflow-hidden rounded-xl border text-left shadow-xl transition sm:w-[220px] ${
                              isSelected
                                ? "border-white bg-white"
                                : "border-white/70 bg-white hover:border-white"
                            }`}
                          >
                            <OptimizedImage
                              src={placeImage(place)}
                              alt={place.name}
                              className="absolute inset-0 transition duration-500 group-hover:scale-105"
                              width={900}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/26 to-transparent" />
                            <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700">
                                {place.type}
                              </span>
                              {isSelected && (
                                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  selected
                                </span>
                              )}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                              <p className="line-clamp-1 text-[10px] font-semibold uppercase tracking-wide text-white/65">
                                {place.parentName}
                              </p>
                              <h2 className="mt-0.5 truncate font-display text-xl font-bold">{place.name}</h2>
                              <span className="mt-1.5 block text-xs font-semibold leading-4 text-white/82">
                                {availableNowLabel(count, copy)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    : filteredRegions.map((region) => {
                        const isSelected = region.slug === selectedSlug && !selectedPlaceSlug;
                        const count = coverageCounts[region.slug] || 0;
                        return (
                          <button
                            key={region.slug}
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.blur();
                              setSelectedSlug(region.slug);
                              setSelectedPlaceSlug("");
                              setFilmstripMode("places");
                              setLocationCardOpen(true);
                            }}
                            className={`group relative h-[118px] w-[190px] shrink-0 snap-start overflow-hidden rounded-xl border text-left shadow-xl transition sm:w-[220px] ${
                              isSelected
                                ? "border-white bg-white"
                                : "border-white/70 bg-white hover:border-white"
                            }`}
                          >
                            <OptimizedImage
                              src={regionImage(region)}
                              alt={region.name}
                              className="absolute inset-0 transition duration-500 group-hover:scale-105"
                              width={900}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/26 to-transparent" />
                            <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
                              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700">
                                {region.scope === "islands" ? copy.islands : copy.mainland}
                              </span>
                              {isSelected && (
                                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  selected
                                </span>
                              )}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                              <h2 className="truncate font-display text-xl font-bold">{region.name}</h2>
                              <span className="mt-1.5 block text-xs font-semibold leading-4 text-white/82">
                                {availableNowLabel(count, copy)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxIndex !== null && selectedPhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRegion?.name || "Location"} photo`}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>

          {selectedPhotos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevLightboxPhoto();
              }}
              className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white transition hover:bg-white/24"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPhotos[lightboxIndex]}
            alt={selectedRegion?.name || "Location photo"}
            className="max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />

          {selectedPhotos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNextLightboxPhoto();
              }}
              className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white transition hover:bg-white/24"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}

    </section>
  );
}
