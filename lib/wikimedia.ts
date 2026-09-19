/** Looks up real, freely-licensed reference photos of a public building
 * from Wikimedia Commons — free, open, no API key. Only runs when OSM
 * tagged the building with a `wikimedia_commons` file/category or a
 * `wikidata` id (common for landmarks, civic buildings, transit stations).
 * Fetching multiple angles (not just one photo) gives TRELLIS's multi-image
 * mode more to work with for a fuller, more faithful reconstruction. */
export type CommonsImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
};

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

async function fetchCommonsFileInfo(fileTitle: string): Promise<CommonsImage | null> {
  const url = `${COMMONS_API}?action=query&titles=${encodeURIComponent(
    fileTitle
  )}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0] as
    | { imageinfo?: { url: string; extmetadata?: Record<string, { value: string }> }[] }
    | undefined;
  const info = page?.imageinfo?.[0];
  if (!info?.url) return null;

  return {
    url: info.url,
    title: fileTitle,
    license: info.extmetadata?.LicenseShortName?.value ?? "See Wikimedia Commons for license",
    attribution: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") ?? "Wikimedia Commons contributors",
  };
}

async function fetchCommonsCategoryImages(category: string, limit: number): Promise<CommonsImage[]> {
  const catTitle = category.startsWith("Category:") ? category : `Category:${category}`;
  const url = `${COMMONS_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(
    catTitle
  )}&cmtype=file&cmlimit=${limit}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const members = (data.query?.categorymembers ?? []) as { title: string }[];
  const images = await Promise.all(members.map((m) => fetchCommonsFileInfo(m.title)));
  return images.filter((img): img is CommonsImage => img !== null);
}

async function findCommonsCategory(tags: Record<string, string>): Promise<string | null> {
  if (tags.wikimedia_commons?.startsWith("Category:")) return tags.wikimedia_commons;
  if (!tags.wikidata) return null;
  const url = `${WIKIDATA_API}?action=wbgetclaims&entity=${tags.wikidata}&property=P373&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const category = data.claims?.P373?.[0]?.mainsnak?.datavalue?.value as string | undefined;
  return category ? `Category:${category}` : null;
}

/** A single best photo, kept for places where only one image is shown. */
export async function findBuildingPhoto(tags: Record<string, string>): Promise<CommonsImage | null> {
  const photos = await findBuildingPhotos(tags, 1);
  return photos[0] ?? null;
}

/** Up to `limit` real photos of the building, for multi-image 3D reconstruction. */
export async function findBuildingPhotos(tags: Record<string, string>, limit = 6): Promise<CommonsImage[]> {
  try {
    if (tags.wikimedia_commons?.startsWith("File:")) {
      const single = await fetchCommonsFileInfo(tags.wikimedia_commons);
      if (single) return [single];
    }

    const category = await findCommonsCategory(tags);
    if (category) {
      const images = await fetchCommonsCategoryImages(category, limit);
      if (images.length > 0) return images;
    }

    if (tags.wikidata) {
      const url = `${WIKIDATA_API}?action=wbgetclaims&entity=${tags.wikidata}&property=P18&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const fileName = data.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
      if (!fileName) return [];
      const single = await fetchCommonsFileInfo(`File:${fileName}`);
      return single ? [single] : [];
    }
  } catch {
    return [];
  }
  return [];
}

/** Free-text search across all of Wikimedia Commons by name — unlike
 * findBuildingPhotos, this doesn't need any OSM tag linkage, just a place
 * title the user (or the address itself) gives us. */
export async function searchCommonsByText(query: string, limit = 6): Promise<CommonsImage[]> {
  try {
    const searchUrl = `${COMMONS_API}?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(
      query
    )}&srlimit=${limit}&format=json&origin=*`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const hits = (data.query?.search ?? []) as { title: string }[];
    const images = await Promise.all(hits.map((h) => fetchCommonsFileInfo(h.title)));
    return images.filter((img): img is CommonsImage => img !== null);
  } catch {
    return [];
  }
}
