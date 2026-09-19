/** Searches Openverse — a free, open-source (Creative Commons/WordPress
 * Foundation) image search API aggregating CC-licensed photos from Flickr
 * Commons, museums, and other open collections. No API key required. */
export type OpenverseImage = {
  url: string;
  title: string;
  license: string;
  attribution: string;
};

const OPENVERSE_API = "https://api.openverse.org/v1/images/";

export async function searchOpenverseImages(query: string, limit = 6): Promise<OpenverseImage[]> {
  try {
    const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&page_size=${limit}&mature=false`;
    const res = await fetch(url, { headers: { "User-Agent": "clonify-app/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.results ?? []) as {
      url: string;
      title: string;
      license: string;
      license_version?: string;
      creator?: string;
    }[];
    return results.map((r) => ({
      url: r.url,
      title: r.title || "Untitled",
      license: `CC ${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ""}`,
      attribution: r.creator || "Openverse contributor",
    }));
  } catch {
    return [];
  }
}
