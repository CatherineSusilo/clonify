import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/products";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const scans = await prisma.scan.findMany({
    where: { user: { modelTrainingConsent: true } },
    select: { id: true, userId: true, imageAnalysis: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    format: "onnx-training-manifest-v1",
    note: "Manifest only; export jobs must de-identify and apply retention/deletion policy before training.",
    scans,
  });
}
