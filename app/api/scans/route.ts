import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadScanPhoto, uploadScanPanorama } from "@/lib/storage";
import { getPlanLimits, isAtLimit } from "@/lib/plans";
import { geocodeAddress } from "@/lib/geocode";
import { findPublicBuildingFootprint } from "@/lib/osmBuilding";
import { findBuildingPhotos } from "@/lib/wikimedia";
import { analyzeBlueprint } from "@/lib/blueprintAnalysis";
import { searchPlaceImages } from "@/lib/imageSearch";
import { enqueueScanReconstruction } from "@/lib/queue";
import { ROLES } from "@/lib/roles";

export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { rooms: true } } },
  });

  return NextResponse.json({
    scans,
    plan: getPlanLimits(user.subscription),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!user.role) {
    return NextResponse.json({ error: "Select a role before scanning" }, { status: 400 });
  }

  const plan = getPlanLimits(user.subscription);
  const existingCount = await prisma.scan.count({ where: { userId: user.id } });
  if (isAtLimit(existingCount, plan.maxActiveScans)) {
    return NextResponse.json(
      {
        error: `Starter includes ${plan.maxActiveScans} active scan. Delete one or upgrade to Pro.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  const form = await request.formData();
  const placeTitle = String(form.get("placeTitle") ?? "").trim();
  const street = String(form.get("street") ?? "");
  const city = String(form.get("city") ?? "");
  const state = String(form.get("state") ?? "");
  const country = String(form.get("country") ?? "");
  const metadataRaw = String(form.get("metadata") ?? "{}");
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);
  const panorama = form.get("panorama");

  if (!street || !city) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  if (!ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      role: user.role,
      placeTitle: placeTitle || null,
      street,
      city,
      state,
      country,
      metadata: metadataRaw,
      photoKeys: "[]",
      status: "processing",
    },
  });

  const geo = await geocodeAddress(`${street}, ${city}, ${state}, ${country}`);

  // As soon as we have a location, automatically look for a public building
  // footprint and any freely-licensed reference photos of it — the user
  // never has to say "this is a public building" or attach anything.
  let blueprintSource: string | null = null;
  if (geo) {
    try {
      const footprint = await findPublicBuildingFootprint(geo.lat, geo.lng);
      if (footprint) {
        const buildingPhotos = await findBuildingPhotos(footprint.tags, 6);
        // Clean up the raw OSM-traced outline (jagged, near-collinear
        // points) via Douglas-Peucker simplification before using it.
        const analysis = analyzeBlueprint(footprint.footprint);
        blueprintSource = JSON.stringify({
          ...footprint,
          footprint: analysis.simplifiedFootprint,
          analysis: {
            originalPointCount: analysis.originalPointCount,
            simplifiedPointCount: analysis.simplifiedPointCount,
            areaSquareMeters: analysis.areaSquareMeters,
            cornerCount: analysis.cornerCount,
          },
          photos: buildingPhotos,
          photo: buildingPhotos[0] ?? null,
        });
      }
    } catch (err) {
      console.warn(
        `[scans] Public building footprint lookup failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Once we have a name for the place, search the open web for real photos
  // of it — gives 3D reconstruction more to work with than whatever the
  // user manages to photograph themselves, closer to how the place
  // actually looks (or was designed) than a single angle can show.
  let referenceImages: string = "[]";
  if (placeTitle) {
    try {
      const images = await searchPlaceImages(placeTitle, 8);
      referenceImages = JSON.stringify(images);
    } catch (err) {
      console.warn(
        `[scans] Place image search failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const photoKeys: string[] = [];
  for (const photo of photos) {
    try {
      photoKeys.push(await uploadScanPhoto(scan.id, photo));
    } catch (err) {
      console.warn(
        `[scans] Storage upload failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
      photoKeys.push(`local-fallback/${photo.name}`);
    }
  }

  let panoramaKey: string | null = null;
  if (panorama instanceof File) {
    try {
      panoramaKey = await uploadScanPanorama(scan.id, panorama);
    } catch (err) {
      console.warn(
        `[scans] Panorama upload failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      photoKeys: JSON.stringify(photoKeys),
      panoramaKey,
      referenceImages,
      lat: geo?.lat,
      lng: geo?.lng,
      blueprintSource,
      isPublicBuilding: blueprintSource !== null,
    },
  });

  await enqueueScanReconstruction(scan.id);

  return NextResponse.json({ scan: { id: scan.id } }, { status: 201 });
}
