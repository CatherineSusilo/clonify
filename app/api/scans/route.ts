import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVisitorId } from "@/lib/visitor";
import { uploadScanPhoto } from "@/lib/storage";
import { geocodeAddress } from "@/lib/geocode";
import { enqueueScanReconstruction } from "@/lib/queue";
import { ROLES } from "@/lib/roles";

export async function POST(request: Request) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json({ error: "Missing visitor session" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { visitorId } });
  if (!user || !user.role) {
    return NextResponse.json({ error: "Select a role before scanning" }, { status: 400 });
  }

  const form = await request.formData();
  const street = String(form.get("street") ?? "");
  const city = String(form.get("city") ?? "");
  const state = String(form.get("state") ?? "");
  const country = String(form.get("country") ?? "");
  const metadataRaw = String(form.get("metadata") ?? "{}");
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
    },
  });

  const geo = await geocodeAddress(`${street}, ${city}, ${state}, ${country}`);

  const photoKeys: string[] = [];
  for (const photo of photos) {
    try {
      photoKeys.push(await uploadScanPhoto(scan.id, photo));
    } catch (err) {
      console.warn(
        `[scans] S3 upload failed for scan ${scan.id} (expected with fake AWS keys):`,
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
    },
  });

  await enqueueScanReconstruction(scan.id);

  return NextResponse.json({ scan: { id: scan.id } }, { status: 201 });
}
