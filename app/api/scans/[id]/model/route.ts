import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildRoomMockupGlb, buildBlueprintExtrusionGlb } from "@/lib/roomMockup";
import { projectToLocalMeters, type Point } from "@/lib/blueprintAnalysis";
import { normalizePixelPolygonToMeters } from "@/lib/imageAnalysis";

/** Serves a .glb model for whenever real photo-to-3D reconstruction
 * (TRELLIS) hasn't produced a model: the "geometry fallback" that always
 * renders something. Prefers the real footprint when one is known — an OSM
 * building outline (real meters) first, then an OpenCV-detected blueprint/
 * photo contour (normalized to a plausible scale) — extruded into actual
 * wall geometry that matches the real layout. Falls back to a generic box
 * only when no footprint could be determined at all. */
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
  const wallColorHex = metadata.wallColorHex;
  const floorColorHex = metadata.floorColorHex;
  const height = metadata.roomHeight ? Number(metadata.roomHeight) : undefined;

  const footprint = resolveFootprintMeters(scan.blueprintSource, scan.imageAnalysis);
  const glb = footprint
    ? buildBlueprintExtrusionGlb(footprint, { height, wallColorHex, floorColorHex })
    : buildRoomMockupGlb({
        wallColorHex,
        floorColorHex,
        height,
        width: metadata.roomWidth ? Number(metadata.roomWidth) : undefined,
        depth: metadata.roomDepth ? Number(metadata.roomDepth) : undefined,
      });

  return new NextResponse(new Uint8Array(glb), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "private, max-age=3600" },
  });
}

function resolveFootprintMeters(
  blueprintSource: string | null,
  imageAnalysis: string | null
): { x: number; y: number }[] | null {
  if (blueprintSource) {
    try {
      const parsed = JSON.parse(blueprintSource) as { footprint?: Point[] };
      if (parsed.footprint && parsed.footprint.length >= 3) {
        return projectToLocalMeters(parsed.footprint);
      }
    } catch {
      // fall through to the OpenCV-derived footprint
    }
  }

  if (imageAnalysis) {
    try {
      const parsed = JSON.parse(imageAnalysis) as { largestContourPoints?: { x: number; y: number }[] };
      if (parsed.largestContourPoints && parsed.largestContourPoints.length >= 3) {
        return normalizePixelPolygonToMeters(parsed.largestContourPoints);
      }
    } catch {
      // fall through to the generic box
    }
  }

  return null;
}
