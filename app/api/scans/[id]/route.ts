import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
    include: { rooms: true },
  });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ scan, plan: getPlanLimits(user.subscription) });
}

export async function DELETE(
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
  await prisma.$transaction([
    prisma.room.deleteMany({ where: { scanId: id } }),
    prisma.scan.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
