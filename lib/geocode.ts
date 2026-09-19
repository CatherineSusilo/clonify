export async function geocodeAddress(query: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "clonify-app/1.0" },
    });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

export type AddressSuggestion = {
  label: string;
  placeName: string | null;
  street: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
};

/** Address autocomplete via Nominatim — free, open, no API key. Used
 * client-side through /api/geocode/suggest, not called directly from the
 * browser (Nominatim's usage policy asks for a descriptive User-Agent and
 * server-side traffic, not raw client requests from every visitor). */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=5&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, { headers: { "User-Agent": "clonify-app/1.0" } });
  if (!res.ok) return [];
  const results = (await res.json()) as {
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
    namedetails?: Record<string, string>;
  }[];

  return results.map((r) => {
    const addr = r.address ?? {};
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ") || addr.neighbourhood || "";
    return {
      label: r.display_name,
      // A named place (e.g. "CN Tower") vs. a plain street address has no
      // useful "title" beyond its address — namedetails.name only exists
      // for named points of interest.
      placeName: r.namedetails?.name ?? null,
      street,
      city: addr.city ?? addr.town ?? addr.village ?? "",
      state: addr.state ?? addr.state_code ?? "",
      country: addr.country ?? "",
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}
