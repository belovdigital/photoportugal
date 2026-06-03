"use client";

import { useEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";

type MapboxGL = typeof mapboxgl;

declare global {
  interface Window {
    mapboxgl?: MapboxGL;
    __photoPortugalMapboxPromise?: Promise<MapboxGL>;
  }
}

/**
 * Loads the Mapbox GL JS library on demand. Mirrors LocationExplorer's
 * loader so both components share one global script tag — no double load,
 * no second CSS link, no duplicate worker. Vendor files live under
 * /public/vendor/mapbox/ so the bundle stays small.
 */
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

/**
 * Tilted 3D Mapbox view of a single spot. Used in the spot page "About"
 * section — half the row is text, the other half is this map. Mapbox's
 * Standard style renders extruded buildings, terrain, and atmospheric
 * fog out of the box, so a 60° pitch + close zoom gives the stylised
 * city-flyover look the user asked for.
 *
 * The marker is a 64px circular div centred on the coordinates; if a
 * thumbnail URL is provided it's used as the background image (same
 * conceit as Airbnb's "stays" pins). Falls back to a primary-coloured
 * dot when no thumbnail exists.
 */
export function SpotMap({
  coordinates,
  spotName,
  thumbnailUrl,
  mapboxToken,
}: {
  coordinates: { lat: number; lng: number };
  spotName: string;
  thumbnailUrl?: string;
  mapboxToken: string;
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
        // Mapbox Standard ships 3D buildings + terrain by default — the
        // best out-of-box "stylised flyover" without custom shaders.
        style: "mapbox://styles/mapbox/standard",
        center: [coordinates.lng, coordinates.lat],
        zoom: 16,
        pitch: 60,
        bearing: -22,
        minZoom: 13,
        maxZoom: 19,
        attributionControl: false,
        cooperativeGestures: true,
        // Disable rotation drag so swiping on mobile pans the page rather
        // than spinning the map (which feels broken on a static spot view).
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
        // Custom marker — circular div with the spot's hero image. Sits
        // dead-centre on the coordinates so the 3D buildings around it
        // give a sense of scale.
        const el = document.createElement("div");
        el.className = "photoportugal-spot-pin";
        el.setAttribute("aria-label", spotName);
        if (thumbnailUrl) {
          el.style.backgroundImage = `url(${JSON.stringify(thumbnailUrl)})`;
        }

        new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([coordinates.lng, coordinates.lat])
          .addTo(map);

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
  }, [coordinates.lat, coordinates.lng, mapboxToken, spotName, thumbnailUrl]);

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
      <div ref={containerRef} className="photoportugal-spot-map h-full w-full" />
      <style jsx global>{`
        .photoportugal-spot-pin {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          background-color: #C94536;
          border: 4px solid white;
          box-shadow: 0 6px 20px -4px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05);
          transform: translateY(-6px);
          transition: transform 200ms ease;
        }
        .photoportugal-spot-pin::after {
          /* Pin tail — small triangle pointing to the actual coordinate */
          content: "";
          position: absolute;
          left: 50%;
          bottom: -6px;
          transform: translateX(-50%) rotate(45deg);
          width: 12px;
          height: 12px;
          background: white;
          border-right: 1px solid rgba(0,0,0,0.05);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          z-index: -1;
        }
        .photoportugal-spot-map .mapboxgl-ctrl-logo,
        .photoportugal-spot-map .mapboxgl-ctrl-attrib {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
