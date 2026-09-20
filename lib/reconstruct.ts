import { prisma } from "./prisma";
import { DEFAULT_ROOMS } from "./defaultRooms";
import type { RoleKey } from "./roles";
import { downloadPhoto } from "./storage";
import { reconstructWithMapAnything, type SourceImage } from "./mapAnything";

const MAX_SOURCE_IMAGES = 24;

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
 * panorama and overview photos plus the largest freely-licensed interior
 * references found for the place/address. Exterior map/building photos are
 * intentionally excluded: they cannot faithfully describe an indoor space. */
async function gatherSourceImages(scanId: string, scan: {
  panoramaKey: string | null;
  blueprintKey: string | null;
  photoKeys: string;
  blueprintSource: string | null;
  referenceImages: string;
  publicBlueprints: string;
}): Promise<SourceImage[]> {
  const images: SourceImage[] = [];

  // A manually supplied floor plan is the strongest ground truth available
  // for this space's layout, so it goes first.
  if (scan.blueprintKey) {
    try {
      images.push({ bytes: await downloadPhoto(scan.blueprintKey), filename: "blueprint.jpg" });
    } catch {
      // fall through to other sources
    }

  }

  // Retrieved public sheets are first-class reconstruction evidence whether
  // or not the user also uploaded a local blueprint. Plans describe layout;
  // elevations/sections add height and facade cues.
  try {
    const blueprintSheets = JSON.parse(scan.publicBlueprints || "[]") as { url: string; title: string; retrievalStatus?: string }[];
    const remoteBlueprints = blueprintSheets.filter((sheet) => sheet.retrievalStatus === "analyzed" && sheet.url);
    images.push(...(await downloadRemoteImages(remoteBlueprints, MAX_SOURCE_IMAGES - images.length)));
  } catch {
    // Keep captured photos as the source of truth if public sheets are malformed.
  }

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
    // Reserve most of the multi-image budget for room captures across floors.
    if (images.length >= 5) break;
    try {
      images.push({ bytes: await downloadPhoto(key), filename: key.split("/").pop() ?? "photo.jpg" });
    } catch {
      continue;
    }
  }

  // Room captures are the authoritative interior record. Order by level so
  // every floor contributes before later, repeated captures consume the budget.
  const rooms = await prisma.room.findMany({ where: { scanId }, orderBy: [{ floor: "asc" }, { createdAt: "asc" }] });
  const roomsByFloor = new Map<number, typeof rooms>();
  for (const room of rooms) roomsByFloor.set(room.floor, [...(roomsByFloor.get(room.floor) ?? []), room]);
  const floorQueues = [...roomsByFloor.values()].map((floorRooms) => [...floorRooms]);
  while (images.length < MAX_SOURCE_IMAGES && floorQueues.some((queue) => queue.length > 0)) {
    for (const queue of floorQueues) {
      const room = queue.shift();
      if (!room || images.length >= MAX_SOURCE_IMAGES) continue;
      if (room.panoramaKey) {
        try {
          images.push({ bytes: await downloadPhoto(room.panoramaKey), filename: `level-${room.floor}-${room.name}-panorama.jpg` });
          if (images.length >= MAX_SOURCE_IMAGES) continue;
        } catch { /* continue with regular photos */ }
      }
      for (const key of JSON.parse(room.photoKeys || "[]") as string[]) {
        if (images.length >= MAX_SOURCE_IMAGES) break;
        try {
          images.push({ bytes: await downloadPhoto(key), filename: `level-${room.floor}-${key.split("/").pop() ?? "room.jpg"}` });
        } catch { /* skip unavailable room asset */ }
      }
    }
  }

  // Only use open, indoor references to fill the remaining budget after each
  // captured floor has had the opportunity to contribute its own evidence.
  if (images.length < MAX_SOURCE_IMAGES) {
    try {
      const referenceImages = JSON.parse(scan.referenceImages || "[]") as { url: string; title: string }[];
      images.push(...(await downloadRemoteImages(referenceImages, MAX_SOURCE_IMAGES - images.length)));
    } catch {
      // no usable place-search photos — fine, proceed with captured evidence
    }
  }

  return images;
}

export async function reconstructScan(scanId: string) {
  try {
    await reconstructScanInner(scanId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reconstruction failed";
    console.error(`[reconstruct] scan ${scanId} failed:`, message);
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "error", errorMessage: message },
    });
  }
}

async function reconstructScanInner(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return;

  const sourceImages = await gatherSourceImages(scanId, scan);
  if (sourceImages.length === 0) throw new Error("No blueprint or image evidence available for MapAnything.");
  const mapAnything = await reconstructWithMapAnything(sourceImages);
  if (!mapAnything.points?.length) throw new Error("MapAnything returned no renderable metric points.");

  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "ready",
      modelUrl: null,
      metadata: JSON.stringify({
        ...JSON.parse(scan.metadata || "{}"),
        mapAnything: mapAnything ?? { provider: "map-anything", status: "not-configured" },
      }),
    },
  });

  const existingRooms = await prisma.room.count({ where: { scanId } });
  if (existingRooms === 0) {
    const defaults = DEFAULT_ROOMS[scan.role as RoleKey] ?? [];
    await prisma.room.createMany({
      data: Array.from({ length: scan.floorCount }, (_, index) =>
        defaults.map((room) => ({ scanId, name: room.name, category: room.category, floor: index + 1 }))
      ).flat(),
    });
  }
}
