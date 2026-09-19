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
