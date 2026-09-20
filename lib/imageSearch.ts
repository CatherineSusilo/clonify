import { searchCommonsByText } from "./wikimedia";
import { searchOpenverseImages } from "./openverse";

export type ReferenceImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
  source: "Wikimedia Commons" | "Openverse";
  width?: number;
  height?: number;
  interiorScore: number;
};

export type BlueprintReference = ReferenceImage & {
  sheetType?: "floor-plan" | "site-plan" | "elevation" | "section" | "unknown";
  mimeType?: string;
};

const INTERIOR_TERMS = /\b(interior|indoor|inside|room|lobby|foyer|hall|corridor|kitchen|bedroom|bathroom|living|dining|office|suite|apartment|gallery|classroom|auditorium|stairwell)\b/i;
const EXTERIOR_TERMS = /\b(exterior|outside|facade|façade|front of|aerial|street|skyline|grounds|parking)\b/i;

function rankInteriorImage(image: Omit<ReferenceImage, "interiorScore">, query: string): ReferenceImage | null {
  const text = `${image.title} ${query}`;
  if (EXTERIOR_TERMS.test(image.title)) return null;
  const area = (image.width ?? 0) * (image.height ?? 0);
  // The query is always interior-specific; title metadata can further boost
  // confidence. Original URLs, rather than thumbnails, are kept for TRELLIS.
  return { ...image, interiorScore: (INTERIOR_TERMS.test(text) ? 100 : 0) + Math.min(area / 100_000, 25) };
}

/** Finds only indoor references for a named place or full address. Queries
 * both open sources with interior-specific terms, removes obvious exteriors,
 * deduplicates, then prefers the largest original images for reconstruction. */
export async function searchInteriorPlaceImages(placeOrAddress: string, limit = 8): Promise<ReferenceImage[]> {
  const perRequest = Math.max(limit, 8);
  const queries = [`${placeOrAddress} interior`, `${placeOrAddress} indoor`];
  const results = await Promise.all(
    queries.flatMap((query) => [
      searchCommonsByText(query, perRequest).then((images) => ({ query, source: "Wikimedia Commons" as const, images })),
      searchOpenverseImages(query, perRequest).then((images) => ({ query, source: "Openverse" as const, images })),
    ])
  );

  const combined = results.flatMap(({ images, source, query }) =>
    images.map((image) => rankInteriorImage({ ...image, source }, query)).filter((image): image is ReferenceImage => image !== null)
  );

  const seen = new Set<string>();
  return combined.filter((img) => {
    const key = img.url.split("?")[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.interiorScore - a.interiorScore).slice(0, limit);
}

const BLUEPRINT_TERMS = /\b(floor ?plan|blueprint|site plan|building plan|plan view|schematic)\b/i;

/** Finds publicly available floor plans / blueprints for a named place, the
 * same way searchInteriorPlaceImages finds interior photos: queries
 * Wikimedia Commons and Openverse with plan-specific terms, then keeps only
 * results whose title actually reads as a plan (avoids photos that merely
 * mention "plan" in passing). */
export async function searchPublicBlueprints(placeOrAddress: string, limit = 4, buildingType?: string): Promise<BlueprintReference[]> {
  const perRequest = Math.max(limit, 8);
  const typeHint = buildingType ? ` ${buildingType}` : "";
  const queries = [
    `${placeOrAddress}${typeHint} floor plan`,
    `${placeOrAddress}${typeHint} site plan`,
    `${placeOrAddress}${typeHint} elevation`,
    `${placeOrAddress}${typeHint} section drawing`,
    `${placeOrAddress}${typeHint} blueprint`,
    `${buildingType || "public building"} floor plan`,
    `${buildingType || "public building"} architectural drawing`,
    `${buildingType || "building"} elevation plan`,
  ];
  const results = await Promise.all(
    queries.flatMap((query) => [
      searchCommonsByText(query, perRequest).then((images) => ({ source: "Wikimedia Commons" as const, images })),
      searchOpenverseImages(query, perRequest).then((images) => ({ source: "Openverse" as const, images })),
    ])
  );

  const combined = results.flatMap(({ images, source }) =>
    images
      .filter((image) =>
        BLUEPRINT_TERMS.test(image.title) ||
        /\b(elevation|section|facade|façade|site plan|architectural drawing|building drawing|campus map|schematic)\b/i.test(image.title)
      )
      .map((image) => ({ ...image, source, interiorScore: (image.width ?? 0) * (image.height ?? 0) }))
  );

  const seen = new Set<string>();
  return combined.filter((img) => {
    const key = img.url.split("?")[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const aSheet = /\b(elevation|section|facade|façade|site plan)\b/i.test(a.title) ? 1 : 0;
    const bSheet = /\b(elevation|section|facade|façade|site plan)\b/i.test(b.title) ? 1 : 0;
    return bSheet - aSheet || b.interiorScore - a.interiorScore;
  }).slice(0, limit);
}
