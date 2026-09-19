import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const bodySchema = z.object({ connectedRoomIds: z.array(z.string()) });

/** Sets which rooms this room connects to for room-to-room navigation.
 * Connections are treated as bidirectional: this also adds/removes this
 * room from the other side's connection list so a single edit keeps the
 * graph consistent both ways. */
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string; roomId: string }> }
) {
  const { id, roomId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const room = await prisma.room.findFirst({ where: { id: roomId, scanId: id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "connectedRoomIds must be a list of room ids" }, { status: 400 });
  }
  // Only rooms belonging to this same scan may be linked — otherwise a
  // caller could pass another user's room id and force a write to it below.
  const allRooms = (await prisma.scan.findUnique({ where: { id } }).rooms()) ?? [];
  const allowed = new Map(allRooms.map((r) => [r.id, r]));

  const requestedIds = parsed.data.connectedRoomIds.filter((rid) => rid !== roomId);
  if (requestedIds.some((rid) => !allowed.has(rid))) {
    return NextResponse.json({ error: "connectedRoomIds must belong to this scan" }, { status: 400 });
  }
  const nextIds = new Set(requestedIds);

  const previousIds = new Set(JSON.parse(room.connections || "[]") as string[]);

  const toAdd = [...nextIds].filter((rid) => !previousIds.has(rid));
  const toRemove = [...previousIds].filter((rid) => !nextIds.has(rid) && allowed.has(rid));

  await prisma.$transaction([
    prisma.room.update({ where: { id: roomId }, data: { connections: JSON.stringify([...nextIds]) } }),
    ...toAdd.map((otherId) => {
      const other = allowed.get(otherId)!;
      const otherConnections = new Set(JSON.parse(other.connections || "[]") as string[]);
      otherConnections.add(roomId);
      return prisma.room.update({
        where: { id: otherId },
        data: { connections: JSON.stringify([...otherConnections]) },
      });
    }),
    ...toRemove.map((otherId) => {
      const other = allowed.get(otherId)!;
      const otherConnections = new Set(JSON.parse(other.connections || "[]") as string[]);
      otherConnections.delete(roomId);
      return prisma.room.update({
        where: { id: otherId },
        data: { connections: JSON.stringify([...otherConnections]) },
      });
    }),
  ]);

  return NextResponse.json({ ok: true });
}
