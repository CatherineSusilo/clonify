export type SourceImage = { bytes: Buffer; filename: string };

export type MapAnythingResult = {
  provider: "map-anything";
  model: string;
  viewCount: number;
  metricScale: number | null;
  meanConfidence: number | null;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  cameraPoses: number[][][] | null;
  pointCount: number;
  points?: [number, number, number][];
};

/** Calls the local MapAnything inference service. The service is intentionally
 * separate from Next.js because MapAnything requires Python/PyTorch and
 * GPU-aware model loading. No external hosted inference is used. */
export async function reconstructWithMapAnything(images: SourceImage[]): Promise<MapAnythingResult> {
  const { ensureMapAnythingService } = await import("./mapAnythingServer");
  const endpoint = await ensureMapAnythingService();
  if (images.length === 0) throw new Error("MapAnything needs at least one image");

  const form = new FormData();
  const maxViews = Math.max(1, Math.min(8, Number(process.env.MAP_ANYTHING_MAX_VIEWS ?? 4)));
  for (const image of images.slice(0, maxViews)) {
    form.append("images", new Blob([new Uint8Array(image.bytes)]), image.filename);
  }
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/infer`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`MapAnything inference failed: ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ""}`);
  }
  return (await response.json()) as MapAnythingResult;
}
