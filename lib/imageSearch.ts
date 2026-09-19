import { searchCommonsByText } from "./wikimedia";
import { searchOpenverseImages } from "./openverse";

export type ReferenceImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
  source: "Wikimedia Commons" | "Openverse";
};

/** Searches the open web for real photos of a named place — used once the
 * user enters a location, so 3D reconstruction has more than one source
 * photo to work with even for buildings OpenStreetMap has no metadata for.
 * Both sources are free and require no API key. */
export async function searchPlaceImages(placeTitle: string, limit = 8): Promise<ReferenceImage[]> {
  const perSource = Math.ceil(limit / 2);
  const [commons, openverse] = await Promise.all([
    searchCommonsByText(placeTitle, perSource),
    searchOpenverseImages(placeTitle, perSource),
  ]);

  const combined: ReferenceImage[] = [
    ...commons.map((img) => ({ ...img, source: "Wikimedia Commons" as const })),
    ...openverse.map((img) => ({ ...img, source: "Openverse" as const })),
  ];

  const seen = new Set<string>();
  return combined.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  }).slice(0, limit);
}
