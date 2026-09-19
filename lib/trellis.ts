import { randomUUID } from "crypto";

/** Real image-to-3D reconstruction via Microsoft's TRELLIS model, called
 * through a public, free, keyless Hugging Face Space (trellis-community/
 * TRELLIS) rather than requiring our own GPU (TRELLIS needs 12GB+ VRAM,
 * which no machine running this app locally has). This is a community-run
 * demo instance — shared, rate-limited, and can be slow, asleep, or
 * unavailable — so every step here fails soft into the caller's fallback.
 *
 * TRELLIS supports genuine multi-image reconstruction: passing several real
 * photos of the same building (e.g. pulled from Wikimedia Commons once the
 * address resolves) produces a fuller, more faithful model than a single
 * photo — closer to the actual structure than one angle can capture. */

const SPACE_BASE = process.env.TRELLIS_SPACE_URL ?? "https://trellis-community-trellis.hf.space";
const API_NAME = "generate_and_extract_glb";

export type SourceImage = { bytes: Buffer; filename: string };

async function uploadImage(image: SourceImage): Promise<string> {
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(image.bytes)]), image.filename);
  const res = await fetch(`${SPACE_BASE}/gradio_api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`TRELLIS upload failed: ${res.status}`);
  const paths = (await res.json()) as string[];
  if (!paths[0]) throw new Error("TRELLIS upload returned no path");
  return paths[0];
}

/** Parses a Gradio SSE call stream, returning the completion event's data. */
async function readEventStream(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`TRELLIS stream failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
        if (line.startsWith("data:")) {
          const raw = line.slice(5).trim();
          if (currentEvent === "error") throw new Error(`TRELLIS generation error: ${raw}`);
          if (currentEvent === "complete") return JSON.parse(raw);
        }
      }
    }
    throw new Error("TRELLIS stream ended without a result");
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs TRELLIS image-to-3D on one or more images and returns a public
 * .glb URL. Multiple images (same building, different angles) use TRELLIS's
 * multi-image mode for a fuller reconstruction. Total budget ~2.5 minutes:
 * this is a real GPU inference job on shared community hardware, not an
 * instant API call. */
export async function reconstructWithTrellis(images: SourceImage[]): Promise<string> {
  if (images.length === 0) throw new Error("No source images provided");

  const uploaded = await Promise.all(images.map(uploadImage));
  const fileData = (path: string) => ({ path, meta: { _type: "gradio.FileData" } });
  const sessionHash = randomUUID().replace(/-/g, "");

  const callRes = await fetch(`${SPACE_BASE}/gradio_api/call/${API_NAME}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_hash: sessionHash,
      data: [
        fileData(uploaded[0]), // primary image
        uploaded.slice(1).map(fileData), // gallery: additional angles, if any
        null, // session state
        0, // seed
        7.5, // guidance strength (stage 1)
        12, // sampling steps (stage 1)
        3.0, // guidance strength (stage 2)
        12, // sampling steps (stage 2)
        uploaded.length > 1 ? "multidiffusion" : "stochastic", // multi-image algorithm
        0.95, // simplify
        1024, // texture size
      ],
    }),
  });
  if (!callRes.ok) throw new Error(`TRELLIS call failed: ${callRes.status}`);
  const { event_id: eventId } = (await callRes.json()) as { event_id: string };

  const result = (await readEventStream(
    `${SPACE_BASE}/gradio_api/call/${API_NAME}/${eventId}`,
    150_000
  )) as unknown[];

  // Outputs: [state, video, litmodel3d (glb/gaussian), downloadbutton]
  const glbOutput = result?.[3] as { url?: string; path?: string } | undefined;
  const glbUrl = glbOutput?.url ?? (glbOutput?.path ? `${SPACE_BASE}/gradio_api/file=${glbOutput.path}` : undefined);
  if (!glbUrl) throw new Error("TRELLIS result had no GLB file");
  return glbUrl;
}
