import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildPointCloudGlb } from "@/lib/roomMockup";

/** Serves the bounded metric MapAnything point cloud as a GLB. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const metadata = JSON.parse(scan.metadata || "{}") as { mapAnything?: { points?: [number, number, number][] } };
  const points = metadata.mapAnything?.points;
  if (!points?.length) return NextResponse.json({ error: "MapAnything model is not ready." }, { status: 409 });
  const glb = buildPointCloudGlb(points);

  return new NextResponse(new Uint8Array(glb), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "private, max-age=3600" },
  });
}
