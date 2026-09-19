/** Looks up the footprint of a public building from OpenStreetMap via the
 * Overpass API — free, open, no API key, and legally reusable under the
 * Open Database License (ODbL) *with attribution*, which callers must show
 * wherever this data is displayed.
 *
 * This deliberately does NOT attempt to fetch actual architectural blueprint
 * drawings from municipal permit portals: those are usually copyrighted or
 * licensed per-city, and scraping them without confirming each portal's
 * terms would be a real legal risk. A building footprint traced by OSM
 * contributors is the closest thing to a "public blueprint" that is
 * unambiguously licensed for reuse. */
export type OsmBuildingResult = {
  provider: "openstreetmap";
  osmId: number;
  attribution: string;
  license: string;
  tags: Record<string, string>;
  footprint: { lat: number; lng: number }[];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function findPublicBuildingFootprint(
  lat: number,
  lng: number
): Promise<OsmBuildingResult | null> {
  const radiusMeters = 60;
  const query = `
    [out:json][timeout:15];
    way(around:${radiusMeters},${lat},${lng})["building"];
    out tags geom;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": "clonify-app/1.0 (indoor navigation scan tool)",
    },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`);

  const data = (await res.json()) as {
    elements: {
      id: number;
      tags?: Record<string, string>;
      geometry?: { lat: number; lon: number }[];
    }[];
  };

  const way = data.elements.find((el) => el.geometry && el.geometry.length > 2);
  if (!way || !way.geometry) return null;

  return {
    provider: "openstreetmap",
    osmId: way.id,
    attribution: "© OpenStreetMap contributors",
    license: "Open Database License (ODbL) v1.0",
    tags: way.tags ?? {},
    footprint: way.geometry.map((p) => ({ lat: p.lat, lng: p.lon })),
  };
}
