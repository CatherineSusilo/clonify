import { prisma } from "./prisma";
import { DEFAULT_ROOMS } from "./defaultRooms";
import type { RoleKey } from "./roles";
import { downloadPhoto } from "./storage";
import { reconstructWithTrellis, type SourceImage } from "./trellis";

const MAX_SOURCE_IMAGES = 8;

async function downloadRemoteImages(
  urlList: { url: string; title: string }[],
  remainingSlots: number
): Promise<SourceImage[]> {
  const images: SourceImage[] = [];
  for (const photo of urlList) {
    if (images.length >= remainingSlots) break;
    try {
      const res = await fetch(photo.url);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      images.push({ bytes, filename: photo.title.replace(/^File:/, "") });
    } catch {
      continue;
    }
  }
  return images;
}

/** Gathers every real photo available for this scan — the user's own
 * panorama and overview photos, freely-licensed reference photos
 * auto-fetched from Wikimedia Commons for a public building, and any
 * images found by searching the place's name online — so TRELLIS's
 * multi-image mode has as much to work with as possible, closer to how the
 * place actually looks (or was designed) than any single photo could show. */
async function gatherSourceImages(scan: {
  panoramaKey: string | null;
  photoKeys: string;
  blueprintSource: string | null;
  referenceImages: string;
}): Promise<SourceImage[]> {
  const images: SourceImage[] = [];

  if (scan.panoramaKey) {
    try {
      images.push({ bytes: await downloadPhoto(scan.panoramaKey), filename: "panorama.jpg" });
    } catch {
      // fall through to other sources
    }
  }

  const photoKeys = (JSON.parse(scan.photoKeys || "[]") as string[]).filter(
    (k) => !k.startsWith("local-fallback/")
  );
  for (const key of photoKeys) {
    if (images.length >= MAX_SOURCE_IMAGES) break;
    try {
      images.push({ bytes: await downloadPhoto(key), filename: key.split("/").pop() ?? "photo.jpg" });
    } catch {
      continue;
    }
  }

  if (images.length < MAX_SOURCE_IMAGES) {
    try {
      const referenceImages = JSON.parse(scan.referenceImages || "[]") as { url: string; title: string }[];
      images.push(...(await downloadRemoteImages(referenceImages, MAX_SOURCE_IMAGES - images.length)));
    } catch {
      // no usable place-search photos — fine, proceed with what we have
    }
  }

  if (images.length < MAX_SOURCE_IMAGES && scan.blueprintSource) {
    try {
      const { photos } = JSON.parse(scan.blueprintSource) as {
        photos?: { url: string; title: string }[];
      };
      images.push(...(await downloadRemoteImages(photos ?? [], MAX_SOURCE_IMAGES - images.length)));
    } catch {
      // no usable blueprint photos — fine, proceed with what we have
    }
  }

  return images;
}

export async function reconstructScan(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return;

  // modelUrl stays null until we have a real reconstruction; the viewer
  // falls back to the procedurally generated room mockup (/api/scans/:id/model)
  // when it's null, instead of an unrelated placeholder model.
  let modelUrl: string | null = null;

  const sourceImages = await gatherSourceImages(scan);
  if (sourceImages.length > 0) {
    try {
      modelUrl = await reconstructWithTrellis(sourceImages);
    } catch (err) {
      console.warn(
        `[reconstruct] TRELLIS reconstruction unavailable for scan ${scanId}, using room mockup:`,
        err instanceof Error ? err.message : err
      );
    }
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
