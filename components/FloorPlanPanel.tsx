"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type PositioningResult = {
  distanceMeters: number;
  bearingDegrees: number;
  fixCount: number;
};

function offsetGeojson(geojson: GeoJSON.FeatureCollection, lat: number, lng: number) {
  return {
    ...geojson,
    features: geojson.features.map((f) => ({
      ...f,
      geometry:
        f.geometry.type === "Polygon"
          ? {
              ...f.geometry,
              coordinates: f.geometry.coordinates.map((ring) =>
                ring.map(([x, y]) => [x + lng, y + lat])
              ),
            }
          : f.geometry,
    })),
  } as GeoJSON.FeatureCollection;
}

export function FloorPlanPanel({
  lat,
  lng,
}: {
  lat?: number | null;
  lng?: number | null;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [positioning, setPositioning] = useState<PositioningResult | null>(null);
  const [positioningStatus, setPositioningStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [positioningError, setPositioningError] = useState<string | null>(null);

  const centerLat = lat ?? 43.6532;
  const centerLng = lng ?? -79.3832;

  useEffect(() => {
    if (!mapContainer.current) return;

    // OpenFreeMap: free, open-source, CORS-enabled vector tiles built for
    // MapLibre — real OSM street-level detail worldwide, no API key.
    // (Raw tile.openstreetmap.org raster tiles don't send CORS headers,
    // which MapLibre's fetch-based tile loader requires.)
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [centerLng, centerLat],
      zoom: 19,
      pitch: 45,
    });

    map.on("error", (e) => {
      setMapError(e.error?.message ?? "Failed to load map tiles");
    });

    // The container's flex layout may not have its final size yet on the
    // frame the map is constructed, which leaves MapLibre computing a 0-size
    // viewport and requesting no tiles. Force a resize once layout settles.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainer.current);

    map.on("load", async () => {
      map.resize();
      try {
        const res = await fetch("/imdf/demo-venue.geojson");
        const geojson = (await res.json()) as GeoJSON.FeatureCollection;
        const positioned = offsetGeojson(geojson, centerLat, centerLng);

        map.addSource("imdf-units", { type: "geojson", data: positioned });
        map.addLayer({
          id: "imdf-units-extrusion",
          type: "fill-extrusion",
          source: "imdf-units",
          paint: {
            "fill-extrusion-color": [
              "match",
              ["get", "category"],
              "restroom",
              "#38bdf8",
              "#818cf8",
            ],
            "fill-extrusion-height": ["*", ["get", "height"], 3],
            "fill-extrusion-opacity": 0.85,
          },
        });

        new maplibregl.Marker({ color: "#f97316" })
          .setLngLat([centerLng, centerLat])
          .addTo(map);
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Failed to load IMDF venue data");
      }
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (lat == null || lng == null) {
      setPositioningStatus("error");
      setPositioningError("No geocoded location for this scan");
      return;
    }
    fetch(`/api/positioning/refine?lat=${lat}&lng=${lng}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Positioning request failed");
        setPositioning(data);
        setPositioningStatus("ready");
      })
      .catch((err) => {
        setPositioningStatus("error");
        setPositioningError(err instanceof Error ? err.message : "Positioning request failed");
      });
  }, [lat, lng]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div ref={mapContainer} className="min-h-[280px] flex-1" />
      {mapError && (
        <p className="border-t border-zinc-800 px-3 py-2 text-xs text-amber-400">
          Map tiles unavailable: {mapError}
        </p>
      )}
      <div className="border-t border-zinc-800 px-3 py-2 text-xs">
        {positioningStatus === "loading" && (
          <p className="text-zinc-500">Running OpenHPS indoor positioning…</p>
        )}
        {positioningStatus === "error" && (
          <p className="text-amber-400">Indoor positioning unavailable — {positioningError}.</p>
        )}
        {positioningStatus === "ready" && positioning && (
          <p className="text-emerald-400">
            OpenHPS (Kalman-filtered): {positioning.fixCount} fixes fused, refined position{" "}
            {positioning.distanceMeters.toFixed(1)}m from GPS anchor, bearing{" "}
            {positioning.bearingDegrees.toFixed(0)}°.
          </p>
        )}
      </div>
    </div>
  );
}
