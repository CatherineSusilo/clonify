/** Analyzes an auto-retrieved building footprint (the "blueprint" this app
 * can legally obtain — see lib/osmBuilding.ts) using the Douglas-Peucker
 * polyline simplification algorithm: the same algorithm OpenCV's
 * `cv.approxPolyDP` implements internally.
 *
 * (An earlier pass tried to depend on @techstark/opencv-js directly, but
 * its WASM runtime never finished initializing in this environment — no
 * error, no completion, even after 45s. Rather than ship a multi-MB
 * dependency that may not reliably start, this implements the exact
 * algorithm by hand: no runtime to fail, same output.)
 *
 * OSM-traced building outlines are often jagged with near-collinear
 * points from imprecise tracing. Simplifying them yields cleaner corners
 * for both the map overlay and the procedural room shape derived from it. */

export type Point = { lat: number; lng: number };

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.lng - lineStart.lng, point.lat - lineStart.lat);
  }
  const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lengthSquared;
  const projLng = lineStart.lng + t * dx;
  const projLat = lineStart.lat + t * dy;
  return Math.hypot(point.lng - projLng, point.lat - projLat);
}

/** Douglas-Peucker simplification. `epsilon` is in the same units as the
 * points (degrees, for lat/lng — ~1e-5 degrees is roughly 1 meter). */
export function simplifyPolygon(points: Point[], epsilon = 2e-6): Point[] {
  if (points.length < 3) return points;

  function recurse(pts: Point[]): Point[] {
    if (pts.length < 3) return pts;
    let maxDist = 0;
    let maxIndex = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    if (maxDist > epsilon) {
      const left = recurse(pts.slice(0, maxIndex + 1));
      const right = recurse(pts.slice(maxIndex));
      return [...left.slice(0, -1), ...right];
    }
    return [pts[0], pts[pts.length - 1]];
  }

  return recurse(points);
}

export type BlueprintAnalysis = {
  originalPointCount: number;
  simplifiedPointCount: number;
  simplifiedFootprint: Point[];
  areaSquareMeters: number;
  cornerCount: number;
};

/** Shoelace formula, converting degrees to approximate meters at the
 * footprint's latitude so the area is a real (if approximate) figure. */
function polygonAreaSquareMeters(points: Point[]): number {
  if (points.length < 3) return 0;
  const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((avgLat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.lng * metersPerDegLng * (p2.lat * metersPerDegLat) - p2.lng * metersPerDegLng * (p1.lat * metersPerDegLat);
  }
  return Math.abs(area / 2);
}

export function analyzeBlueprint(footprint: Point[]): BlueprintAnalysis {
  const simplified = simplifyPolygon(footprint);
  return {
    originalPointCount: footprint.length,
    simplifiedPointCount: simplified.length,
    simplifiedFootprint: simplified,
    areaSquareMeters: polygonAreaSquareMeters(simplified),
    cornerCount: Math.max(0, simplified.length - 1), // last point repeats the first for a closed ring
  };
}
