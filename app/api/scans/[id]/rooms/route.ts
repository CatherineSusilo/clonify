import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPlanLimits, isAtLimit } from "@/lib/plans";

const bodySchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().max(40).optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a room name" }, { status: 400 });
  }

  const plan = getPlanLimits(user.subscription);
  const roomCount = await prisma.room.count({ where: { scanId: id } });
  if (isAtLimit(roomCount, plan.maxRoomsPerScan)) {
    return NextResponse.json(
      {
        error: `Starter includes ${plan.maxRoomsPerScan} rooms per scan. Upgrade to Pro for unlimited rooms.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  const room = await prisma.room.create({
    data: { scanId: id, name: parsed.data.name, category: parsed.data.category },
  });
  return NextResponse.json({ room }, { status: 201 });
}
