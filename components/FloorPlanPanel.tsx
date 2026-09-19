"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ReferencePhoto = { url: string; title: string; license: string; attribution: string };

export type BuildingFootprint = {
  provider: string;
  attribution: string;
  license: string;
  tags: Record<string, string>;
  footprint: { lat: number; lng: number }[];
  photo?: ReferencePhoto | null;
  photos?: ReferencePhoto[];
  analysis?: {
    originalPointCount: number;
    simplifiedPointCount: number;
    areaSquareMeters: number;
    cornerCount: number;
  };
};

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

function footprintToGeojson(building: BuildingFootprint): GeoJSON.FeatureCollection {
  const levels = parseInt(building.tags["building:levels"] ?? "1", 10) || 1;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { category: "building", height: levels * 3, name: building.tags.name ?? "Building" },
        geometry: {
          type: "Polygon",
          coordinates: [building.footprint.map((p) => [p.lng, p.lat])],
        },
      },
    ],
  };
}

export function FloorPlanPanel({
  lat,
  lng,
  building,
}: {
  lat?: number | null;
  lng?: number | null;
  building?: BuildingFootprint | null;
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
      zoom: 17.5,
      pitch: 55,
      bearing: -17,
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
        // Prefer the real OpenStreetMap building footprint (legally reusable
        // open data, ODbL) when one was found for this address. Otherwise
        // fall back to an illustrative room layout — no floor-plan-level
        // open data exists for arbitrary private buildings.
        const geojson = building
          ? footprintToGeojson(building)
          : offsetGeojson(
              (await (await fetch("/imdf/demo-venue.geojson")).json()) as GeoJSON.FeatureCollection,
              centerLat,
              centerLng
            );

        map.addSource("building-outline", { type: "geojson", data: geojson });
        map.addLayer({
          id: "building-outline-extrusion",
          type: "fill-extrusion",
          source: "building-outline",
          paint: {
            "fill-extrusion-color": [
              "match",
              ["get", "category"],
              "restroom",
              "#5cff9d",
              "building",
              "#22c55e",
              "#39ff6a",
            ],
            "fill-extrusion-height": ["*", ["get", "height"], 3],
            "fill-extrusion-opacity": 0.85,
          },
        });

        new maplibregl.Marker({ color: "#ffcc4d" })
          .setLngLat([centerLng, centerLat])
          .addTo(map);
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Failed to load building outline");
      }
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, [centerLat, centerLng, building]);

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
    <div className="flex h-full flex-col overflow-hidden border border-line bg-ink-soft">
      <div ref={mapContainer} className="min-h-[280px] flex-1" />
      {mapError && (
        <p className="border-t border-line px-3 py-2 text-xs text-amber">
          Map tiles unavailable: {mapError}
        </p>
      )}
      {building && (
        <div className="border-t border-line px-3 py-2 text-xs text-muted">
          <p>
            Building outline: {building.attribution}, {building.license}
            {building.analysis &&
              ` — simplified ${building.analysis.originalPointCount} → ${building.analysis.simplifiedPointCount} points, ~${Math.round(
                building.analysis.areaSquareMeters
              )}m² footprint`}
          </p>
          {building.photos && building.photos.length > 0 && (
            <div className="mt-2">
              <p className="mb-1">
                {building.photos.length} reference photo(s) found automatically — fed into 3D
                reconstruction:
              </p>
              <div className="flex gap-1.5">
                {building.photos.slice(0, 6).map((photo, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- external Commons URLs, not worth an image loader config for small attribution thumbnails
                  <img
                    key={i}
                    src={photo.url}
                    alt={photo.title}
                    title={`${photo.attribution}, ${photo.license}`}
                    className="h-12 w-16 border border-line object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="border-t border-line px-3 py-2 text-xs">
        {positioningStatus === "loading" && (
          <p className="text-muted">Running indoor positioning…</p>
        )}
        {positioningStatus === "error" && (
          <p className="text-amber">Indoor positioning unavailable — {positioningError}.</p>
        )}
        {positioningStatus === "ready" && positioning && (
          <p className="text-signal">
            {positioning.fixCount} position fixes fused, {positioning.distanceMeters.toFixed(1)}m
            from GPS anchor, bearing {positioning.bearingDegrees.toFixed(0)}°.
          </p>
        )}
      </div>
    </div>
  );
}
