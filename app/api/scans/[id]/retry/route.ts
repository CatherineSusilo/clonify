import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { enqueueScanReconstruction } from "@/lib/queue";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.scan.update({
    where: { id },
    data: { status: "processing", errorMessage: null },
  });
  await enqueueScanReconstruction(id);

  return NextResponse.json({ ok: true });
}
