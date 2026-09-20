import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadScanPhoto, uploadScanPanorama, uploadScanBlueprint } from "@/lib/storage";
import { getPlanLimits, isAtLimit } from "@/lib/plans";
import { geocodeAddress } from "@/lib/geocode";
import { findPublicBuildingFootprint } from "@/lib/osmBuilding";
import { analyzeBlueprint } from "@/lib/blueprintAnalysis";
import { searchInteriorPlaceImages } from "@/lib/imageSearch";
import { retrieveAndAnalyzeBlueprints, blueprintGeometryForModel } from "@/lib/blueprintPipeline";
import { analyzeImageWithOpenCV } from "@/lib/imageAnalysis";
import { safeFetch } from "@/lib/safeFetch";
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

  try {
    return await createScan(request, user);
  } catch (err) {
    console.error("[scans] Failed to create scan:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }
}

async function createScan(request: Request, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const form = await request.formData();
  const placeTitle = String(form.get("placeTitle") ?? "").trim();
  const buildingType = String(form.get("buildingType") ?? "other").trim();
  const requestedFloorCount = Number.parseInt(String(form.get("floorCount") ?? "1"), 10);
  const floorCount = Number.isFinite(requestedFloorCount) ? Math.max(1, Math.min(99, requestedFloorCount)) : 1;
  const street = String(form.get("street") ?? "");
  const city = String(form.get("city") ?? "");
  const state = String(form.get("state") ?? "");
  const country = String(form.get("country") ?? "");
  const metadataRaw = String(form.get("metadata") ?? "{}");
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);
  const panorama = form.get("panorama");
  const blueprint = form.get("blueprint");
  const role = user.role;

  if (!street || !city) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      role,
      placeTitle: placeTitle || null,
      street,
      city,
      state,
      country,
      metadata: metadataRaw,
      floorCount,
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
        });
      }
    } catch (err) {
      console.warn(
        `[scans] Public building footprint lookup failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Aggregate original-size, freely licensed *indoor* references for the
  // place or address. Exterior building photos are deliberately not used to
  // fabricate a private interior environment.
  let referenceImages: string = "[]";
  const placeQuery = placeTitle || [street, city, state, country].filter(Boolean).join(", ");
  if (placeQuery) {
    try {
      const images = await searchInteriorPlaceImages(`${placeQuery} ${buildingType}`, 8);
      referenceImages = JSON.stringify(images);
    } catch (err) {
      console.warn(
        `[scans] Place image search failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Same idea as the indoor reference photo search above, but for actual
  // floor plans / blueprints (Wikimedia Commons, Openverse). Public data
  // only — never fabricated.
  let publicBlueprints: string = "[]";
  if (placeQuery) {
    try {
      const blueprints = await retrieveAndAnalyzeBlueprints(placeQuery, buildingType, 10);
      publicBlueprints = JSON.stringify(blueprints);
    } catch (err) {
      console.warn(
        `[scans] Blueprint search failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Run real OpenCV (edge + contour detection) on whichever source image
  // best represents the space's layout: a manually uploaded blueprint first
  // (the user's own ground truth), then a found blueprint, falling back to
  // the first uploaded overview photo.
  let imageAnalysis: string | null = null;
  try {
    const blueprintUrl = (JSON.parse(publicBlueprints) as { url: string }[])[0]?.url;
    const analysisSource =
      blueprint instanceof File
        ? Buffer.from(await blueprint.arrayBuffer())
        : blueprintUrl
          ? Buffer.from(await (await safeFetch(blueprintUrl)).arrayBuffer())
          : photos[0]
            ? Buffer.from(await photos[0].arrayBuffer())
            : null;
    if (analysisSource) {
      imageAnalysis = JSON.stringify(await analyzeImageWithOpenCV(analysisSource));
    }
  } catch (err) {
    console.warn(
      `[scans] OpenCV image analysis failed for scan ${scan.id}:`,
      err instanceof Error ? err.message : err
    );
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

  let blueprintKey: string | null = null;
  if (blueprint instanceof File) {
    try {
      blueprintKey = await uploadScanBlueprint(scan.id, blueprint);
    } catch (err) {
      console.warn(
        `[scans] Blueprint upload failed for scan ${scan.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      photoKeys: JSON.stringify(photoKeys),
      panoramaKey,
      blueprintKey,
      referenceImages,
      publicBlueprints,
      imageAnalysis: JSON.stringify({
        primary: imageAnalysis ? JSON.parse(imageAnalysis) : null,
        buildingType,
        sheets: JSON.parse(publicBlueprints).map((sheet: { title: string; kind: string; analysis?: unknown }) => ({
          title: sheet.title,
          kind: sheet.kind,
          analysis: sheet.analysis ?? null,
        })),
        modelGeometry: blueprintGeometryForModel(JSON.parse(publicBlueprints)),
      }),
      metadata: JSON.stringify({ ...JSON.parse(metadataRaw), buildingType }),
      lat: geo?.lat,
      lng: geo?.lng,
      blueprintSource,
      isPublicBuilding: blueprintSource !== null,
    },
  });

  await enqueueScanReconstruction(scan.id);

  return NextResponse.json({ scan: { id: scan.id } }, { status: 201 });
}
