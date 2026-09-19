"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type BuildingFootprint = {
  provider: string;
  attribution: string;
  license: string;
  tags: Record<string, string>;
  footprint: { lat: number; lng: number }[];
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

function approachSide(lat: number, lng: number, building: BuildingFootprint) {
  const points = building.footprint;
  if (!points.length) return "Unknown side";
  const center = points.reduce(
    (total, point) => ({ lat: total.lat + point.lat / points.length, lng: total.lng + point.lng / points.length }),
    { lat: 0, lng: 0 }
  );
  const north = lat - center.lat;
  const east = (lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
  const angle = (Math.atan2(east, north) * 180) / Math.PI;
  const labels = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];
  return labels[(Math.round(angle / 45) + 8) % 8];
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const watchId = useRef<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [positioning, setPositioning] = useState<PositioningResult | null>(null);
  const [positioningStatus, setPositioningStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [positioningError, setPositioningError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("GPS motion tracking is off.");
  const [currentSide, setCurrentSide] = useState<string | null>(null);

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
    mapRef.current = map;

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

        map.addSource("motion-track", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "motion-track-line",
          type: "line",
          source: "motion-track",
          filter: ["==", ["geometry-type"], "LineString"],
          paint: { "line-color": "#ffcc4d", "line-width": 4, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "motion-track-point",
          type: "circle",
          source: "motion-track",
          filter: ["==", ["geometry-type"], "Point"],
          paint: { "circle-color": "#ffcc4d", "circle-radius": 7, "circle-stroke-color": "#060c07", "circle-stroke-width": 2 },
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
      if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
      watchId.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [centerLat, centerLng, building]);

  useEffect(() => {
    if (lat == null || lng == null) {
      queueMicrotask(() => {
        setPositioningStatus("error");
        setPositioningError("No geocoded location for this scan");
      });
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

  function toggleMotionTracking() {
    if (tracking) {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
      setTrackingStatus("GPS motion tracking is paused.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setTrackingStatus("This device does not provide GPS location.");
      return;
    }
    const trace: [number, number][] = [];
    setTrackingStatus("Requesting precise location permission…");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        trace.push(point);
        if (trace.length > 60) trace.shift();
        const source = mapRef.current?.getSource("motion-track") as maplibregl.GeoJSONSource | undefined;
        source?.setData({
          type: "FeatureCollection",
          features: [
            ...(trace.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: trace } }] : []),
            { type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: point } },
          ],
        });
        const side = building ? approachSide(position.coords.latitude, position.coords.longitude, building) : null;
        setCurrentSide(side);
        setTrackingStatus(
          side
            ? `Tracking ${trace.length} fixes · approaching the ${side.toLowerCase()} side.`
            : `Tracking ${trace.length} fixes · add a building outline to identify the approach side.`
        );
        setTracking(true);
      },
      (error) => {
        setTracking(false);
        setTrackingStatus(error.code === error.PERMISSION_DENIED ? "Location permission was not granted." : "GPS signal is currently unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border border-line bg-ink-soft">
      <div ref={mapContainer} className="min-h-[280px] flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
        <div>
          <p className={tracking ? "text-signal" : "text-muted"}>{trackingStatus}</p>
          {currentSide && <p className="mt-0.5 text-blueprint-light">Map match: {currentSide} building approach</p>}
        </div>
        <button type="button" onClick={toggleMotionTracking} className="border border-blueprint-light px-2.5 py-1.5 text-ink-text hover:bg-blueprint-light/10">
          {tracking ? "Pause GPS" : "Track my approach"}
        </button>
      </div>
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
