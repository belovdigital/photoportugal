"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
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
import { country, byCountry } from "@/lib/country";
import { Link } from "@/i18n/navigation";

// The country name declined per language. This component carries its own copy
// block (it predates the messages catalogue), so the market name has to be
// substituted here rather than through the override layer.
const ES_COUNTRY = country.countryName.es;
const PT_COUNTRY = country.countryName.pt;
const DE_COUNTRY = country.countryName.de;
// French needs the article, which the bare name does not carry.
const FR_COUNTRY = byCountry({ pt: "le Portugal", es: "l'Espagne", it: "l'Italie" });



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

// A region card borrows the photo of its most representative place, because
// there is no photo filed under the region slug itself. Only the Portuguese
// regions were listed, so every Spanish region card asked for an image that
// does not exist — `locationImage` returns "" for an unknown slug, and the
// cards rendered as broken images with the alt text showing through.
const REGION_IMAGE_SLUGS: Record<string, string> = byCountry<Record<string, string>>({
  pt: {
    "lisbon-region": "lisbon",
    "porto-north": "porto",
    "central-portugal": "nazare",
    alentejo: "evora",
    algarve: "algarve",
    madeira: "madeira",
    azores: "azores",
  },
  es: {
    catalonia: "barcelona",
    "madrid-region": "madrid",
    andalusia: "seville",
    "balearic-islands": "mallorca",
    "canary-islands": "tenerife",
    "valencia-region": "valencia",
    "basque-country": "san-sebastian",
    galicia: "santiago-de-compostela",
  },
  it: {
    lazio: "rome",
    tuscany: "florence",
    veneto: "venice",
    lombardy: "milan",
    campania: "amalfi-coast",
    sicily: "taormina",
    liguria: "cinque-terre",
    puglia: "alberobello",
  },
});

const COPY = {
  en: {
    eyebrow: `${country.areaServed} photo map`,
    title: "Choose the place by feeling",
    subtitle: `Swipe through ${country.areaServed}'s regions, tap the map, then open photographers where the trip actually happens.`,
    search: byCountry({ pt: "Search Lisbon, Azores, Algarve...", es: "Search Barcelona, Madrid, Mallorca...", it: "Search Rome, Amalfi, Tuscany..." }),
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
    portugalWide: `${country.areaServed}-wide`,
    reviewed: "Reviewed profiles",
    filters: "Filters",
    swipe: "Destinations",
  },
  pt: {
    eyebrow: `Mapa fotográfico de ${PT_COUNTRY}`,
    title: "Escolha o lugar pela sensação",
    subtitle: "Explore as regiões, toque no mapa e veja fotógrafos onde a viagem acontece.",
    search: byCountry({ pt: "Pesquisar Lisboa, Açores, Algarve...", es: "Pesquisar Barcelona, Madrid, Maiorca...", it: "Pesquisar Roma, Amalfi, Toscana..." }),
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
    portugalWide: `${PT_COUNTRY} inteiro`,
    reviewed: "Perfis revistos",
    filters: "Filtros",
    swipe: "Destinos",
  },
  de: {
    eyebrow: `${DE_COUNTRY}-Fotokarte`,
    title: "Waehlen Sie den Ort nach Gefuehl",
    subtitle: "Durch Regionen swipen, Karte antippen und Fotografen dort oeffnen, wo die Reise passiert.",
    search: byCountry({ pt: "Lissabon, Azoren, Algarve suchen...", es: "Barcelona, Madrid, Mallorca suchen...", it: "Rom, Amalfi, Toskana suchen..." }),
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
    portugalWide: `${DE_COUNTRY}weit`,
    reviewed: "Gepruefte Profile",
    filters: "Filter",
    swipe: "Ziele",
  },
  es: {
    eyebrow: `Mapa fotográfico de ${ES_COUNTRY}`,
    title: "Elija el lugar por su ambiente",
    subtitle: "Deslice regiones, toque el mapa y vea fotógrafos donde sucede el viaje.",
    search: byCountry({ pt: "Buscar Lisboa, Azores, Algarve...", es: "Buscar Barcelona, Madrid, Mallorca...", it: "Buscar Roma, Amalfi, Toscana..." }),
    all: "Todo",
    mainland: "Continente",
    islands: "Islas",
    photographers: "fotógrafos",
    photographer: "fotógrafo",
    availableNow: "disponibles ahora",
    show: "Ver fotógrafos",
    coveredAreas: "Lugares dentro",
    islandInsets: "Islas",
    noResults: "Ninguna ubicación coincide con los filtros.",
    mapUnavailable: "El mapa no está disponible porque falta el token de Mapbox.",
    // "Portugal" is masculine, "España" feminine — a shared `Todo ${country}`
    // template produced "Todo España" on every region card.
    portugalWide: byCountry({ pt: "Todo Portugal", es: "Toda España", it: "Tutta Italia" }),
    reviewed: "Perfiles revisados",
    filters: "Filtros",
    swipe: "Destinos",
  },
  fr: {
    eyebrow: `Carte photo de ${FR_COUNTRY}`,
    title: "Choisissez le lieu par l'ambiance",
    subtitle: "Faites défiler les régions, touchez la carte et ouvrez les photographes là où le voyage se passe.",
    search: byCountry({ pt: "Rechercher Lisbonne, Açores, Algarve...", es: "Rechercher Barcelone, Madrid, Majorque...", it: "Rechercher Rome, Amalfi, Toscane..." }),
    all: "Tout",
    mainland: "Continent",
    islands: "Îles",
    photographers: "photographes",
    photographer: "photographe",
    availableNow: "disponibles maintenant",
    show: "Voir les photographes",
    coveredAreas: "Lieux inclus",
    islandInsets: "Îles",
    noResults: "Aucune destination ne correspond aux filtres.",
    mapUnavailable: "La carte est indisponible car le token Mapbox manque.",
    // Same gender problem as the Spanish block: "tout le Portugal" but
    // "toute l'Espagne".
    portugalWide: byCountry({ pt: "Tout le Portugal", es: "Toute l'Espagne", it: "Toute l'Italie" }),
    reviewed: "Profils vérifiés",
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

// Last-resort photo so an unmapped slug degrades to a real picture instead of a
// broken <img> showing its alt text. Points at the market's flagship city.
const FALLBACK_IMAGE_SLUG = byCountry({ pt: "lisbon", es: "barcelona", it: "rome" });

/**
 * Resolve per-locale display names once, at the point the data enters the
 * component, so that cards, map markers, breadcrumbs AND the search index all
 * agree without each call site having to know about `names`. Resolving at each
 * render site instead would mean a visitor could see "Cataluña" on the card but
 * fail to find it by typing "Cataluña" in the search box.
 *
 * Entries without a translation for this locale keep `name` untouched, so
 * Portugal — where no entry defines `names` — gets exactly the old objects.
 */
function localizeRegions(regions: LocationExplorerRegion[], locale: string): LocationExplorerRegion[] {
  const translated = <T extends { name: string; names?: Record<string, string> }>(node: T): T => {
    const localized = node.names?.[locale];
    return localized ? { ...node, name: localized } : node;
  };
  const localizeChild = (child: LocationExplorerChild): LocationExplorerChild => {
    const next = translated(child);
    return child.children ? { ...next, children: child.children.map(localizeChild) } : next;
  };
  return regions.map((region) => ({
    ...translated(region),
    children: region.children.map(localizeChild),
  }));
}

function regionImage(region: LocationExplorerRegion): string {
  return (
    locationImage(REGION_IMAGE_SLUGS[region.slug] || region.slug, "cardLarge") ||
    locationImage(FALLBACK_IMAGE_SLUG, "cardLarge")
  );
}

function placeImage(place: ExplorerPlace): string {
  return (
    locationImage(place.slug, "cardLarge") ||
    regionImage(place.region) ||
    locationImage(FALLBACK_IMAGE_SLUG, "cardLarge")
  );
}

export function LocationExplorer({ locale, mapboxToken, totalPhotographers, coverageCounts, regionPhotographers }: Props) {
  const copy = COPY[(locale as keyof typeof COPY)] ?? COPY.en;
  const regions = useMemo(() => localizeRegions(LOCATION_EXPLORER_REGIONS, locale), [locale]);
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
  const [mobileSheetSnap, setMobileSheetSnap] = useState<"peek" | "mid" | "full">("peek");
  const [mobileSheetDragY, setMobileSheetDragY] = useState(0);
  const [mobileSheetDragging, setMobileSheetDragging] = useState(false);
  const mobileSheetDragRef = useRef({ active: false, startY: 0, startSnap: "peek" as "peek" | "mid" | "full" });
  const mobileSheetExpanded = mobileSheetSnap !== "peek";

  const setMobileSheetExpanded = (expanded: boolean) => {
    setMobileSheetSnap(expanded ? "mid" : "peek");
    setMobileSheetDragY(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setScope("all");
      setFilmstripMode("places");
      setMobileSheetSnap("full");
      setMobileSheetDragY(0);
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

  const snapOrder: Array<"peek" | "mid" | "full"> = ["peek", "mid", "full"];
  const mobileSheetClass = {
    peek: "h-[218px]",
    mid: "h-[52svh]",
    full: "h-[78svh]",
  }[mobileSheetSnap];
  const mobileSheetListClass = mobileSheetSnap === "full" ? "max-h-[42svh]" : "max-h-[24svh]";

  const startMobileSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    mobileSheetDragRef.current = {
      active: true,
      startY: event.clientY,
      startSnap: mobileSheetSnap,
    };
    setMobileSheetDragging(true);
    setMobileSheetDragY(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveMobileSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!mobileSheetDragRef.current.active) return;
    const delta = event.clientY - mobileSheetDragRef.current.startY;
    setMobileSheetDragY(Math.max(-120, Math.min(180, delta)));
  };

  const stopMobileSheetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!mobileSheetDragRef.current.active) return;
    mobileSheetDragRef.current.active = false;
    setMobileSheetDragging(false);
    const delta = event.clientY - mobileSheetDragRef.current.startY;
    const currentIndex = snapOrder.indexOf(mobileSheetDragRef.current.startSnap);
    let nextIndex = currentIndex;

    if (delta < -44) nextIndex = Math.min(snapOrder.length - 1, currentIndex + 1);
    else if (delta > 44) nextIndex = Math.max(0, currentIndex - 1);
    else if (Math.abs(delta) < 10) nextIndex = currentIndex === 0 ? 1 : currentIndex === 1 ? 2 : 0;

    setMobileSheetSnap(snapOrder[nextIndex]);
    setMobileSheetDragY(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const allPlaces = useMemo(
    () => regions.flatMap((region) => flattenRegionPlaces(region)),
    [regions]
  );

  const filteredRegions = useMemo(() => {
    const q = normalize(query.trim());
    return regions.filter((region) => {
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
  }, [regions, query, scope, shootFilter, vibeFilter]);

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
    () => regions.find((region) => region.slug === selectedSlug) || regions[0],
    [regions, selectedSlug]
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
        setMobileSheetExpanded(true);
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
  // Left unprefixed on purpose: <Link> resolves it through the pathnames
  // table, which pasting "/{locale}" in front never did — that produced
  // /de/photographers?location=lazio and a redirect to /de/fotografen?…
  const selectedPhotographersHref = selectedPlace
    ? `/photographers?location=${selectedPlace.slug}`
    : selectedRegion ? selectedRegion.photographerHref : "";
  const selectedTitle = selectedPlace?.name || selectedRegion.name;
  const selectedKicker = selectedPlace
    ? `${selectedPlace.type} in ${selectedPlace.parentName}`
    : selectedRegion.scope === "islands" ? copy.islands : copy.mainland;
  const selectedSummary = selectedPlace
    ? `${selectedPlace.name} is inside ${selectedPlace.parentName}. Open photographers who cover this exact place, or use the region card to browse nearby options.`
    : selectedRegion.summary;
  const mobileSheetTitle = showPlaceFilmstrip
    ? query.trim()
      ? `Places matching "${query.trim()}"`
      : `${selectedRegion.name} places`
    : copy.swipe;

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
      <div className="h-below-chrome relative min-h-[620px] lg:min-h-[700px]">
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
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
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
	                        setMobileSheetExpanded(false);
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
                  <Link
                    href={selectedPhotographersHref}
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    {copy.show}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 lg:hidden">
            <div
              className={`mx-auto max-w-md overflow-hidden rounded-t-[24px] border border-warm-200 bg-white shadow-[0_-14px_40px_rgba(15,23,42,0.18)] ${mobileSheetClass} ${
                mobileSheetDragging ? "" : "transition-[height,transform] duration-300"
              }`}
              style={{ transform: `translateY(${mobileSheetDragY}px)` }}
            >
              <button
                type="button"
                onPointerDown={startMobileSheetDrag}
                onPointerMove={moveMobileSheetDrag}
                onPointerUp={stopMobileSheetDrag}
                onPointerCancel={stopMobileSheetDrag}
                className="touch-none block w-full cursor-grab px-4 pb-2 pt-3 active:cursor-grabbing"
                aria-expanded={mobileSheetExpanded}
              >
                <span className="mx-auto block h-1.5 w-11 rounded-full bg-warm-300" />
              </button>

              <div className="px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => selectedPhotos.length > 0 && setLightboxIndex(photoIndex)}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-warm-100"
                    aria-label={`Open ${selectedTitle} photo`}
                  >
                    {selectedPhotos[photoIndex] && (
                      <OptimizedImage
                        src={selectedPhotos[photoIndex]}
                        alt={selectedTitle}
                        width={300}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold uppercase tracking-wide text-primary-700">
                      {selectedKicker}
                    </p>
                    <h2 className="truncate font-display text-2xl font-bold text-gray-950">{selectedTitle}</h2>
                    <p className="truncate text-sm font-semibold text-gray-500">
                      {availableNowLabel(selectedCount, copy)}
                    </p>
                  </div>
                </div>

                <Link
                  href={selectedPhotographersHref}
                  className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  {copy.show}
                  <ChevronRight className="h-4 w-4" />
                </Link>

                <div className={`transition-opacity duration-200 ${mobileSheetExpanded ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                  {mobileSheetSnap === "full" && selectedPhotos.length > 1 && (
                    <div className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {selectedPhotos.slice(0, 6).map((photo, index) => (
                        <button
                          key={`${photo}-${index}-mobile`}
                          type="button"
                          onClick={() => {
                            setPhotoIndex(index);
                            setLightboxIndex(index);
                          }}
                          className="h-24 w-36 shrink-0 snap-start overflow-hidden rounded-xl bg-warm-100"
                          aria-label={`Open photo ${index + 1}`}
                        >
                          <OptimizedImage src={photo} alt={`${selectedTitle} photo ${index + 1}`} width={420} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold uppercase tracking-wide text-gray-500">
                        {mobileSheetTitle}
                      </p>
                    </div>
                    {showPlaceFilmstrip && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setSelectedPlaceSlug("");
                          setFilmstripMode("regions");
                          setMobileSheetExpanded(true);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warm-200 bg-white px-3 py-1.5 text-xs font-bold text-primary-700"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Regions
                      </button>
                    )}
                  </div>

                  <div className={`mt-3 space-y-2 overflow-y-auto pr-1 ${mobileSheetListClass}`}>
                    {(showPlaceFilmstrip ? filmstripPlaces : filteredRegions).length === 0 ? (
                      <div className="rounded-2xl border border-warm-200 bg-warm-50 p-5 text-center text-sm text-gray-500">
                        {copy.noResults}
                      </div>
                    ) : showPlaceFilmstrip ? (
                      filmstripPlaces.map((place) => {
                        const isSelected = place.slug === selectedPlaceSlug;
                        const count = coverageCounts[place.slug] || 0;
                        return (
                          <button
                            key={place.slug}
                            type="button"
                            onClick={() => {
                              setSelectedSlug(place.parentSlug);
                              setSelectedPlaceSlug(place.slug);
                              setFilmstripMode("places");
                              setMobileSheetExpanded(false);
                              setLocationCardOpen(true);
                            }}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition ${
                              isSelected ? "border-primary-200 bg-primary-50" : "border-warm-200 bg-white"
                            }`}
                          >
                            <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-warm-100">
                              <OptimizedImage src={placeImage(place)} alt={place.name} width={260} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-primary-700">
                                {place.type} in {place.parentName}
                              </p>
                              <h3 className="truncate text-base font-bold text-gray-950">{place.name}</h3>
                              <p className="truncate text-xs font-semibold text-gray-500">{availableNowLabel(count, copy)}</p>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      filteredRegions.map((region) => {
                        const isSelected = region.slug === selectedSlug && !selectedPlaceSlug;
                        const count = coverageCounts[region.slug] || 0;
                        return (
                          <button
                            key={region.slug}
                            type="button"
                            onClick={() => {
                              setSelectedSlug(region.slug);
                              setSelectedPlaceSlug("");
                              setFilmstripMode("places");
                              setMobileSheetExpanded(true);
                              setLocationCardOpen(true);
                            }}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition ${
                              isSelected ? "border-primary-200 bg-primary-50" : "border-warm-200 bg-white"
                            }`}
                          >
                            <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-warm-100">
                              <OptimizedImage src={regionImage(region)} alt={region.name} width={260} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-primary-700">
                                {region.scope === "islands" ? copy.islands : copy.mainland}
                              </p>
                              <h3 className="truncate text-base font-bold text-gray-950">{region.name}</h3>
                              <p className="truncate text-xs font-semibold text-gray-500">{availableNowLabel(count, copy)}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-0 left-1/2 z-20 hidden w-screen -translate-x-1/2 lg:block">
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
