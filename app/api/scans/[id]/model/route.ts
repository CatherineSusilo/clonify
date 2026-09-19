import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildRoomMockupGlb } from "@/lib/roomMockup";

/** Serves a procedurally generated room mockup (.glb) colored from the
 * scan's own metadata, used whenever real photo-to-3D reconstruction
 * (TRELLIS) hasn't produced a model — so the viewer shows an actual room
 * shape instead of an unrelated placeholder. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const metadata = JSON.parse(scan.metadata || "{}") as Record<string, string>;
  const glb = buildRoomMockupGlb({
    wallColorHex: metadata.wallColorHex,
    floorColorHex: metadata.floorColorHex,
    width: metadata.roomWidth ? Number(metadata.roomWidth) : undefined,
    depth: metadata.roomDepth ? Number(metadata.roomDepth) : undefined,
    height: metadata.roomHeight ? Number(metadata.roomHeight) : undefined,
  });

  return new NextResponse(new Uint8Array(glb), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "private, max-age=3600" },
  });
}
