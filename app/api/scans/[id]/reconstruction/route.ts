import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconstructionPayload, type ReconstructionMode } from "@/lib/reconstruction";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const configuredMode: ReconstructionMode = process.env.RECONSTRUCTION_MODE === "local"
    ? "local"
    : "private-server";
  const metadata = JSON.parse(scan.metadata || "{}") as Record<string, string | undefined>;
  const modelUrl = scan.modelUrl ?? `/api/scans/${scan.id}/model`;

  return NextResponse.json(reconstructionPayload(metadata, modelUrl, configuredMode));
}
