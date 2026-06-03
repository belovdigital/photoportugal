"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type mapboxgl from "mapbox-gl";

type MapboxGL = typeof mapboxgl;

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

export interface CityMapPin {
  city: string;
  slug: string;
  name: string;
  coordinates: { lat: number; lng: number };
  thumbnailUrl?: string;
  description?: string;
}

/** React component for the spot popup. Replaces the HTML-string version
 *  so we get standard JSX, Tailwind, and don't have to escape attributes
 *  by hand. Mounted into a detached div which Mapbox positions for us. */
function SpotPopup({ pin, localePrefix }: { pin: CityMapPin; localePrefix: string }) {
  const href = `${localePrefix}/spots/${pin.city}/${pin.slug}`;
  return (
    <a
      href={href}
      className="block w-[210px] overflow-hidden rounded-2xl bg-white text-left text-gray-900 no-underline shadow-lg transition hover:shadow-xl"
    >
      <div
        className="h-28 w-full bg-warm-100 bg-cover bg-center"
        style={pin.thumbnailUrl ? { backgroundImage: `url("${pin.thumbnailUrl}")` } : undefined}
      />
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-bold leading-tight text-gray-900">{pin.name}</p>
        {pin.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-gray-500">{pin.description}</p>
        )}
        <p className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary-600">
          Open spot
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </p>
      </div>
    </a>
  );
}

/**
 * Tilted 3D Mapbox view of an entire city's photo spots. Zooms to fit
 * all pins; each pin is a 48px circular thumbnail (or coloured dot when
 * no image) anchored to the spot's coordinates and clickable to open
 * /spots/<city>/<slug>. Used as a section on /locations/[slug] to give
 * the visitor a bird's-eye sense of where photogenic places sit relative
 * to each other before they pick one.
 *
 * Differs from SpotMap in three ways:
 * - Multiple markers, not one
 * - Auto-fit bounds across all pins (not a fixed zoom)
 * - Pins are smaller (48px vs 56px) since several are in the frame
 */
export function CityMap({
  pins,
  cityCenter,
  mapboxToken,
  localePrefix = "",
}: {
  pins: CityMapPin[];
  /** Fallback centre when there are 0–1 pins. Without this, fitBounds
   *  on a single point gives a default-zoom anywhere-on-earth view. */
  cityCenter: { lat: number; lng: number };
  mapboxToken: string;
  /** "" for /en, "/pt", "/de", etc. — used to build spot links so the
   *  visitor stays in their locale when they click a pin. */
  localePrefix?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxRef = useRef<MapboxGL | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    loadMapbox().then((mapboxgl) => {
      if (cancelled || !containerRef.current) return;
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = mapboxToken;
      mapboxgl.workerUrl = "/vendor/mapbox/mapbox-gl-csp-worker.js";

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: [cityCenter.lng, cityCenter.lat],
        zoom: 12,
        pitch: 45,
        bearing: -18,
        minZoom: 8,
        maxZoom: 18,
        attributionControl: false,
        cooperativeGestures: true,
        dragRotate: false,
      });
      mapRef.current = map;

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);

      map.on("error", (event) => {
        const message = event.error?.message || "Mapbox failed to render.";
        setError(message);
      });

      map.on("load", () => {
        // Drop a marker for each pin. Click → opens a React-rendered
        // popup (mounted into a detached div via createRoot, then handed
        // to Mapbox via setDOMContent so it positions/clips correctly).
        // The popup is the whole card linking to the spot page; visitors
        // tap the photo, name, or CTA — all routes go to the same place.
        const validPins = pins.filter((p) => p.coordinates && Number.isFinite(p.coordinates.lat) && Number.isFinite(p.coordinates.lng));

        validPins.forEach((pin) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "photoportugal-city-pin";
          el.setAttribute("aria-label", pin.name);
          el.setAttribute("title", pin.name);
          if (pin.thumbnailUrl) {
            el.style.backgroundImage = `url(${JSON.stringify(pin.thumbnailUrl)})`;
          }

          // React-rendered popup. We keep the root reference so we can
          // unmount on the popup's close event — otherwise we leak roots
          // every time the user opens/closes the same pin.
          const popupNode = document.createElement("div");
          let root: Root | null = null;

          const popup = new mapboxgl.Popup({
            offset: 28,
            closeButton: false,
            closeOnClick: true,
            maxWidth: "240px",
            className: "photoportugal-spot-popup-wrapper",
          }).setDOMContent(popupNode);

          popup.on("open", () => {
            if (!root) root = createRoot(popupNode);
            root.render(<SpotPopup pin={pin} localePrefix={localePrefix} />);
          });
          popup.on("close", () => {
            if (root) {
              const r = root;
              root = null;
              // Defer unmount one tick — React 19 throws if you unmount
              // synchronously inside a render-phase callback chain.
              queueMicrotask(() => r.unmount());
            }
          });

          new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([pin.coordinates.lng, pin.coordinates.lat])
            .setPopup(popup)
            .addTo(map);
        });

        // Auto-fit bounds when there are 2+ pins. With only one valid
        // pin we already centred on the city above, so no fit needed.
        if (validPins.length >= 2) {
          const bounds = new mapboxgl.LngLatBounds();
          validPins.forEach((p) => bounds.extend([p.coordinates.lng, p.coordinates.lat]));
          map.fitBounds(bounds, { padding: 80, pitch: 45, bearing: -18, duration: 0, maxZoom: 14 });
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
        requestAnimationFrame(() => map.resize());
      });
    }).catch((err) => {
      const message = err instanceof Error ? err.message : "Mapbox failed to load.";
      setError(message);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // pins is a derived value re-built on each render — depend on its content
  // signature, not the array reference, so we don't tear down/re-init the
  // map on every parent re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapboxToken,
    cityCenter.lat,
    cityCenter.lng,
    localePrefix,
    pins.map((p) => `${p.city}/${p.slug}`).join("|"),
  ]);

  if (!mapboxToken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-warm-100 to-warm-200 text-xs text-gray-400">
        Map unavailable
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-warm-50 p-4 text-center text-xs text-gray-400">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="photoportugal-city-map h-full w-full" />
      <style jsx global>{`
        .photoportugal-city-pin {
          display: block;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #C94536;
          border: 3px solid white;
          box-shadow: 0 4px 14px -3px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05);
          transform: translateY(-4px);
          cursor: pointer;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .photoportugal-city-pin:hover {
          transform: translateY(-7px) scale(1.08);
          box-shadow: 0 8px 22px -4px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.05);
          z-index: 10;
        }
        .photoportugal-city-pin::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -5px;
          transform: translateX(-50%) rotate(45deg);
          width: 10px;
          height: 10px;
          background: white;
          border-right: 1px solid rgba(0,0,0,0.05);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          z-index: -1;
        }
        .photoportugal-city-map .mapboxgl-ctrl-logo,
        .photoportugal-city-map .mapboxgl-ctrl-attrib {
          display: none !important;
        }
        /* Strip Mapbox's default popup chrome so the React content sits
           flush against the rounded card. Padding/bg moves into the SpotPopup
           component itself. */
        .photoportugal-spot-popup-wrapper .mapboxgl-popup-content {
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          border-radius: 16px;
          overflow: visible;
        }
        .photoportugal-spot-popup-wrapper .mapboxgl-popup-tip {
          border-top-color: white !important;
          border-bottom-color: white !important;
        }
      `}</style>
    </div>
  );
}
