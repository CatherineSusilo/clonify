import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadRoomPhoto, uploadRoomPanorama, getPhotoUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; roomId: string }> }
) {
  const { id, roomId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const room = await prisma.room.findFirst({ where: { id: roomId, scanId: id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const photoKeys = JSON.parse(room.photoKeys || "[]") as string[];
  const photoUrls = await Promise.all(photoKeys.map((key) => getPhotoUrl(key)));
  const panoramaUrl = room.panoramaKey ? await getPhotoUrl(room.panoramaKey) : null;

  return NextResponse.json({ photoUrls, panoramaUrl });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; roomId: string }> }
) {
  const { id, roomId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const room = await prisma.room.findFirst({ where: { id: roomId, scanId: id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const form = await request.formData();
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File);
  const panorama = form.get("panorama");

  const newPhotoKeys: string[] = [];
  for (const photo of photos) {
    try {
      newPhotoKeys.push(await uploadRoomPhoto(id, roomId, photo));
    } catch (err) {
      console.warn(`[rooms] photo upload failed for room ${roomId}:`, err instanceof Error ? err.message : err);
    }
  }

  let panoramaKey = room.panoramaKey;
  if (panorama instanceof File) {
    try {
      panoramaKey = await uploadRoomPanorama(id, roomId, panorama);
    } catch (err) {
      console.warn(`[rooms] panorama upload failed for room ${roomId}:`, err instanceof Error ? err.message : err);
    }
  }

  const existingKeys = JSON.parse(room.photoKeys || "[]") as string[];
  const updated = await prisma.room.update({
    where: { id: roomId },
    data: {
      photoKeys: JSON.stringify([...existingKeys, ...newPhotoKeys]),
      panoramaKey,
    },
  });

  return NextResponse.json({ room: updated });
}
