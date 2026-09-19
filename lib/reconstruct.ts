import { prisma } from "./prisma";
import { DEFAULT_ROOMS } from "./defaultRooms";
import type { RoleKey } from "./roles";

// Public-domain sample glTF model, used as the fallback 3D environment
// whenever the real mesh-reconstruction provider can't be reached (e.g. no
// TRELLIS host configured yet). Real .glb output is AR/VR-ready by
// construction — <model-viewer> exposes it through WebXR, Scene Viewer, and
// Quick Look with no extra conversion step.
export const DEMO_MODEL_URL =
  "https://modelviewer.dev/shared-assets/models/Astronaut.glb";

/** Kicks off TRELLIS (microsoft/TRELLIS) mesh reconstruction from uploaded
 * photo keys against a self-hosted inference server (TRELLIS needs an
 * NVIDIA GPU with 12GB+ VRAM, so it can't run in this Next.js process).
 * Polls for the resulting .glb, and falls back to the demo model if the
 * server is unreachable (expected until TRELLIS_API_URL points at a real
 * GPU host). This assumes a small wrapper service in front of TRELLIS
 * exposing POST /generate -> { jobId } and GET /jobs/:id -> { status, glbUrl },
 * since TRELLIS itself ships as a Python library/Gradio demo, not a fixed
 * REST API — adapt these two calls to whatever wrapper you deploy. */
async function generateMeshWithTrellis(photoKeys: string[]): Promise<string> {
  const baseUrl = process.env.TRELLIS_API_URL;
  if (!baseUrl) throw new Error("TRELLIS_API_URL not configured");

  const createRes = await fetch(`${baseUrl}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_keys: photoKeys, output_format: "glb" }),
  });
  if (!createRes.ok) {
    throw new Error(`TRELLIS request failed: ${createRes.status}`);
  }
  const { jobId } = (await createRes.json()) as { jobId: string };

  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`${baseUrl}/jobs/${jobId}`);
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as {
      status: string;
      glbUrl?: string;
    };
    if (data.status === "completed" && data.glbUrl) return data.glbUrl;
    if (data.status === "failed") throw new Error("TRELLIS generation failed");
  }
  throw new Error("TRELLIS generation timed out");
}

export async function reconstructScan(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return;

  let modelUrl = DEMO_MODEL_URL;
  try {
    const photoKeys = JSON.parse(scan.photoKeys) as string[];
    modelUrl = await generateMeshWithTrellis(photoKeys);
  } catch (err) {
    console.warn(
      `[reconstruct] TRELLIS unavailable for scan ${scanId}, using demo model:`,
      err instanceof Error ? err.message : err
    );
  }

  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "ready", modelUrl },
  });

  const existingRooms = await prisma.room.count({ where: { scanId } });
  if (existingRooms === 0) {
    const defaults = DEFAULT_ROOMS[scan.role as RoleKey] ?? [];
    await prisma.room.createMany({
      data: defaults.map((room) => ({ scanId, name: room.name, category: room.category })),
    });
  }
}
