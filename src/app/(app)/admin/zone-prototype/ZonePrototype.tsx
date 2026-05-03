"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, featureCollection } from "@turf/helpers";
import type { Feature, Polygon, Point } from "geojson";
import { PORTUGAL_CITIES, type PortugalCity } from "@/lib/portugal-cities";

/**
 * Photographer zone-drawing prototype.
 *
 * Renders Portugal on a Mapbox map with city pins, lets the user draw
 * one or more polygons, and live-resolves which cities fall inside any
 * of them. No DB writes, no auth side-effects — purely a UX sandbox.
 *
 * UX:
 *  - Tap "Draw zone" → tap points on the map → double-tap to close
 *  - Draw multiple zones (e.g. one in Lisbon area, another in Algarve)
 *  - Cities inside zones turn red; the right panel lists them
 *  - "×" on a city in the list removes it manually (overrides polygon)
 *  - "Clear all" wipes polygons and selections
 */
export function ZonePrototype({ mapboxToken }: { mapboxToken: string }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [insideCitySlugs, setInsideCitySlugs] = useState<string[]>([]);
  const [manualRemovedSlugs, setManualRemovedSlugs] = useState<Set<string>>(new Set());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      // Center over Portugal mainland, zoom out enough to see Algarve
      // and Porto in the same view.
      center: [-8.3, 39.6],
      zoom: 6.4,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw, "top-left");
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const recompute = () => {
      const all = draw.getAll();
      const polygons = all.features.filter(
        (f) => f.geometry.type === "Polygon"
      ) as Feature<Polygon>[];
      if (polygons.length === 0) {
        setInsideCitySlugs([]);
        return;
      }
      const matched: string[] = [];
      for (const city of PORTUGAL_CITIES) {
        const pt: Feature<Point> = turfPoint([city.lng, city.lat]);
        if (polygons.some((poly) => booleanPointInPolygon(pt, poly))) {
          matched.push(city.slug);
        }
      }
      setInsideCitySlugs(matched);
    };
    map.on("draw.create", recompute);
    map.on("draw.update", recompute);
    map.on("draw.delete", recompute);

    map.on("load", () => {
      // Add a single GeoJSON source for all city pins so we can drive
      // their colour from the inside/outside state without recreating
      // markers on every change.
      map.addSource("cities", {
        type: "geojson",
        data: featureCollection(
          PORTUGAL_CITIES.map((c) =>
            turfPoint([c.lng, c.lat], { slug: c.slug, name: c.name, region: c.region })
          )
        ),
      });
      map.addLayer({
        id: "cities-circles",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": 5,
          "circle-color": "#9CA3AF",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "cities-labels",
        type: "symbol",
        source: "cities",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#374151",
          "text-halo-color": "#fff",
          "text-halo-width": 1.2,
        },
      });
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [mapboxToken]);

  // Re-paint city circles whenever the inside set changes.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const insideSet = new Set(insideCitySlugs);
    mapRef.current.setPaintProperty("cities-circles", "circle-color", [
      "case",
      ["in", ["get", "slug"], ["literal", Array.from(insideSet)]],
      "#C94536", // brand red — inside zone
      "#9CA3AF", // gray — outside
    ]);
    mapRef.current.setPaintProperty("cities-circles", "circle-radius", [
      "case",
      ["in", ["get", "slug"], ["literal", Array.from(insideSet)]],
      8,
      5,
    ]);
  }, [insideCitySlugs, mapReady]);

  const finalSlugs = insideCitySlugs.filter((s) => !manualRemovedSlugs.has(s));
  const finalCities: PortugalCity[] = finalSlugs
    .map((slug) => PORTUGAL_CITIES.find((c) => c.slug === slug))
    .filter((c): c is PortugalCity => !!c);

  const groupedByRegion = finalCities.reduce<Record<string, PortugalCity[]>>(
    (acc, c) => {
      (acc[c.region] ||= []).push(c);
      return acc;
    },
    {}
  );

  if (!mapboxToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-red-600">
          Missing NEXT_PUBLIC_MAPBOX_TOKEN env var. Set it in .env.local and rebuild.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div ref={mapContainer} className="flex-1 relative" />
      <aside className="w-[360px] border-l border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Zone prototype</h1>
          <p className="text-xs text-gray-500 mt-1">
            Use the polygon tool (top-left) to draw one or more zones.
            Cities inside turn red. {PORTUGAL_CITIES.length} cities loaded.
          </p>
          <button
            type="button"
            onClick={() => {
              drawRef.current?.deleteAll();
              setInsideCitySlugs([]);
              setManualRemovedSlugs(new Set());
            }}
            className="mt-3 text-xs font-semibold text-gray-600 underline"
          >
            Clear everything
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              Coverage ({finalCities.length})
            </h2>
            {manualRemovedSlugs.size > 0 && (
              <button
                type="button"
                onClick={() => setManualRemovedSlugs(new Set())}
                className="text-xs text-primary-600 underline"
              >
                Restore {manualRemovedSlugs.size}
              </button>
            )}
          </div>

          {finalCities.length === 0 ? (
            <p className="text-sm text-gray-400">
              Draw a polygon on the map to see which cities fall inside.
            </p>
          ) : (
            Object.entries(groupedByRegion).map(([region, cities]) => (
              <div key={region} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  {region}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((c) => (
                    <button
                      type="button"
                      key={c.slug}
                      onClick={() =>
                        setManualRemovedSlugs((prev) => {
                          const next = new Set(prev);
                          next.add(c.slug);
                          return next;
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      {c.name}
                      <span className="text-red-400">×</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {finalSlugs.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Slugs (for DB)
            </p>
            <code className="text-[11px] text-gray-700 break-all leading-relaxed">
              {JSON.stringify(finalSlugs)}
            </code>
          </div>
        )}
      </aside>
    </div>
  );
}
