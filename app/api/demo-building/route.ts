import { NextResponse } from "next/server";
import { buildRoomMockupGlb } from "@/lib/roomMockup";

export async function GET() {
  const glb = buildRoomMockupGlb({
    width: 8,
    depth: 7,
    height: 2.8,
    levels: 2,
    wallColorHex: "#d8d0bd",
    floorColorHex: "#796857",
  });
  return new NextResponse(new Uint8Array(glb), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "public, max-age=86400" },
  });
}
