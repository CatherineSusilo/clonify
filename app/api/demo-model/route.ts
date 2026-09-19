import { NextResponse } from "next/server";
import { buildRoomMockupGlb } from "@/lib/roomMockup";

/** Public, unauthenticated sample room mockup for the marketing page —
 * no scan context, so just the default room colors. */
export async function GET() {
  const glb = buildRoomMockupGlb({});
  return new NextResponse(new Uint8Array(glb), {
    headers: { "Content-Type": "model/gltf-binary", "Cache-Control": "public, max-age=86400" },
  });
}
