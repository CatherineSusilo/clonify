import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadScanPhoto } from "@/lib/storage";
import { geocodeAddress } from "@/lib/geocode";
import { findPublicBuildingFootprint } from "@/lib/osmBuilding";
import { enqueueScanReconstruction } from "@/lib/queue";
import { ROLES } from "@/lib/roles";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!user.role) {
    return NextResponse.json({ error: "Select a role before scanning" }, { status: 400 });
  }

  const form = await request.formData();
  const street = String(form.get("street") ?? "");
  const city = String(form.get("city") ?? "");
  const state = String(form.get("state") ?? "");
  const country = String(form.get("country") ?? "");
  const metadataRaw = String(form.get("metadata") ?? "{}");
  const isPublicBuilding = String(form.get("isPublicBuilding") ?? "") === "true";
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);

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
      street,
      city,
      state,
      country,
      metadata: metadataRaw,
      photoKeys: "[]",
      status: "processing",
      isPublicBuilding,
    },
  });

  const geo = await geocodeAddress(`${street}, ${city}, ${state}, ${country}`);

  let blueprintSource: string | null = null;
  if (isPublicBuilding && geo) {
    try {
      const footprint = await findPublicBuildingFootprint(geo.lat, geo.lng);
      if (footprint) blueprintSource = JSON.stringify(footprint);
    } catch (err) {
      console.warn(
        `[scans] Public building footprint lookup failed for scan ${scan.id}:`,
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

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      photoKeys: JSON.stringify(photoKeys),
      lat: geo?.lat,
      lng: geo?.lng,
      blueprintSource,
    },
  });

  await enqueueScanReconstruction(scan.id);

  return NextResponse.json({ scan: { id: scan.id } }, { status: 201 });
}
